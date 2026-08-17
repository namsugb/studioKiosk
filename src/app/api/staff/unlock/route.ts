import { verify } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bearerToken, resolveActiveDevice } from "@/lib/auth/device-server";
import { signStaffSession } from "@/lib/auth/staff-session";
import { isDemoMode } from "@/lib/config";
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
    const resolved = await resolveActiveDevice(bearerToken(request), parsed.data.deviceId);
    if (!resolved) return NextResponse.json({ error: "등록된 기기가 아니에요.", code: "DEVICE_NOT_REGISTERED" }, { status: 403 });
    const { device } = resolved;
    const supabase = createAdminClient();
    const { data: pinRow } = await supabase.from("store_pins").select("pin_hash").eq("store_id", device.store_id).single();
    if (!pinRow) return NextResponse.json({ error: "매장 PIN이 설정되지 않았어요." }, { status: 503 });
    valid = await verify(pinRow.pin_hash, parsed.data.pin); storeId = device.store_id; canManageCatalog = device.can_manage_catalog === true;
  }
  if (!valid) return NextResponse.json({ error: "PIN이 올바르지 않아요." }, { status: 401 });
  const token = await signStaffSession({ storeId, deviceId: parsed.data.deviceId, role: "staff", canManageCatalog });
  const response = NextResponse.json({ ok: true, storeId, canManageCatalog });
  response.cookies.set("staff_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 28800 });
  return response;
}