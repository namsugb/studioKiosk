import { verify } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { signStaffSession } from "@/lib/auth/staff-session";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ pin: z.string().regex(/^\d{4,8}$/), deviceId: z.string().min(1) });
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "PIN을 확인해 주세요." }, { status: 400 });
  let valid = false; let storeId = ""; let canManageCatalog = false;
  if (isDemoMode) {
    const demoPin = process.env.DEMO_STAFF_PIN;
    if (!demoPin) return NextResponse.json({ error: "개발용 PIN 환경변수가 설정되지 않았어요." }, { status: 503 });
    valid = parsed.data.pin === demoPin; storeId = "demo-store"; canManageCatalog = process.env.DEMO_CAN_MANAGE_CATALOG === "true";
  } else {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "기기 세션이 필요해요." }, { status: 401 });
    const supabase = createAdminClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "기기 세션이 올바르지 않아요." }, { status: 401 });
    const { data: device } = await supabase.from("devices").select("store_id,can_manage_catalog").eq("id", parsed.data.deviceId).eq("auth_user_id", userData.user.id).eq("device_type", "staff_terminal").eq("active", true).single();
    if (!device) return NextResponse.json({ error: "등록된 직원 기기가 아니에요." }, { status: 403 });
    const { data: pinRow } = await supabase.from("store_pins").select("pin_hash,failed_attempts,locked_until").eq("store_id", device.store_id).single();
    if (!pinRow) return NextResponse.json({ error: "매장 PIN이 설정되지 않았어요." }, { status: 503 });
    if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) return NextResponse.json({ error: "PIN 입력이 잠시 잠겼어요. 5분 뒤 다시 시도해 주세요." }, { status: 429 });
    valid = await verify(pinRow.pin_hash, parsed.data.pin); storeId = device.store_id; canManageCatalog = device.can_manage_catalog === true;
    if (!valid) {
      const attempts = pinRow.failed_attempts + 1;
      await supabase.from("store_pins").update({ failed_attempts: attempts >= 5 ? 0 : attempts, locked_until: attempts >= 5 ? new Date(Date.now() + 300000).toISOString() : null, updated_at: new Date().toISOString() }).eq("store_id", device.store_id);
    } else await supabase.from("store_pins").update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq("store_id", device.store_id);
  }
  if (!valid) return NextResponse.json({ error: "PIN이 올바르지 않아요." }, { status: 401 });
  const token = await signStaffSession({ storeId, deviceId: parsed.data.deviceId, role: "staff_terminal", canManageCatalog });
  const response = NextResponse.json({ ok: true, storeId, canManageCatalog });
  response.cookies.set("staff_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 28800 });
  return response;
}
