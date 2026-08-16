import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ code: z.string().min(6).max(12).transform((value) => value.toUpperCase()) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "활성화 코드를 확인해 주세요." }, { status: 400 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "기기 세션이 필요해요." }, { status: 401 });
  if (isDemoMode) {
    const expected = process.env.DEMO_ACTIVATION_CODE;
    if (!expected || parsed.data.code !== expected.toUpperCase()) return NextResponse.json({ error: "개발용 활성화 코드를 확인해 주세요." }, { status: 401 });
    return NextResponse.json({ deviceId: "demo-kiosk-device", deviceType: "kiosk", storeId: "demo-store" });
  }
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "기기 세션이 올바르지 않아요." }, { status: 401 });
  const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
  const { data: activation } = await admin.from("device_activations").select("*").eq("code_hash", codeHash).is("used_at", null).gt("expires_at", new Date().toISOString()).single();
  if (!activation) return NextResponse.json({ error: "코드가 만료됐거나 이미 사용됐어요." }, { status: 400 });
  const claimedAt = new Date().toISOString();
  const { data: claimed } = await admin.from("device_activations").update({ used_at: claimedAt }).eq("id", activation.id).is("used_at", null).select("*").single();
  if (!claimed) return NextResponse.json({ error: "코드가 이미 사용됐어요." }, { status: 409 });
  const { data: device, error } = await admin.from("devices").insert({ organization_id: claimed.organization_id, store_id: claimed.store_id, device_type: claimed.device_type, name: claimed.device_name, auth_user_id: userData.user.id, can_manage_catalog: claimed.can_manage_catalog, active: true, last_seen_at: claimedAt }).select().single();
  if (error) { await admin.from("device_activations").update({ used_at: null }).eq("id", claimed.id).eq("used_at", claimedAt).is("used_by_device_id", null); return NextResponse.json({ error: "기기를 연결할 수 없어요." }, { status: 500 }); }
  await admin.from("device_activations").update({ used_by_device_id: device.id }).eq("id", claimed.id).eq("used_at", claimedAt);
  return NextResponse.json({ deviceId: device.id, deviceType: device.device_type, storeId: device.store_id, canManageCatalog: device.can_manage_catalog });
}
