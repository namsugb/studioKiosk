import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const normalizeLicense = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const schema = z.object({ licenseKey: z.string().transform(normalizeLicense).pipe(z.string().min(6).max(12)) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "기기 라이선스를 확인해 주세요." }, { status: 400 });

  if (isDemoMode) {
    const expected = process.env.DEMO_DEVICE_LICENSE;
    if (!expected || parsed.data.licenseKey !== normalizeLicense(expected)) return NextResponse.json({ error: "개발용 기기 라이선스를 확인해 주세요." }, { status: 401 });
    return NextResponse.json({ deviceId: "demo-device", storeId: "demo-store", canManageCatalog: process.env.DEMO_CAN_MANAGE_CATALOG === "true" });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "기기 세션이 필요해요." }, { status: 401 });
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "기기 세션이 올바르지 않아요." }, { status: 401 });

  const licenseHash = createHash("sha256").update(parsed.data.licenseKey).digest("hex");
  const { data, error } = await admin.rpc("register_device_with_license", { p_license_hash: licenseHash, p_auth_user_id: userData.user.id });
  if (error) return NextResponse.json({ error: "기기를 등록할 수 없어요." }, { status: 500 });
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.status === "invalid") return NextResponse.json({ error: "유효하지 않은 기기 라이선스예요." }, { status: 400 });
  if (result.status === "redeemed") return NextResponse.json({ error: "이미 사용된 기기 라이선스예요." }, { status: 409 });
  if (result.status === "already_registered") return NextResponse.json({ error: "이미 등록된 기기예요." }, { status: 409 });
  return NextResponse.json({ deviceId: result.device_id, storeId: result.store_id, canManageCatalog: result.can_manage_catalog });
}