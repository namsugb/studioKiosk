import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ organizationId: z.string().min(1), storeId: z.string().min(1), deviceType: z.enum(["kiosk", "staff_terminal"]), deviceName: z.string().min(2).max(80), canManageCatalog: z.boolean().default(false) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "기기 정보를 확인해 주세요." }, { status: 400 });
  if (isDemoMode) { const code = process.env.DEMO_ACTIVATION_CODE; if (!code) return NextResponse.json({ error: "DEMO_ACTIVATION_CODE를 설정해 주세요." }, { status: 503 }); return NextResponse.json({ id: "demo-activation", code: code.toUpperCase(), expiresAt: new Date(Date.now() + 600000).toISOString() }, { status: 201 }); }
  if (!z.string().uuid().safeParse(parsed.data.organizationId).success || !z.string().uuid().safeParse(parsed.data.storeId).success) return NextResponse.json({ error: "사진관과 지점 식별자를 확인해 주세요." }, { status: 400 });
  const user = await requirePlatformUser(); if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = randomBytes(8); const code = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(""); const codeHash = createHash("sha256").update(code).digest("hex");
  const admin = createAdminClient(); const { data: store } = await admin.from("stores").select("id,organization_id").eq("id", parsed.data.storeId).eq("organization_id", parsed.data.organizationId).eq("active", true).single(); if (!store) return NextResponse.json({ error: "지점을 찾을 수 없어요." }, { status: 404 });
  const { data, error } = await admin.from("device_activations").insert({ organization_id: parsed.data.organizationId, store_id: parsed.data.storeId, device_type: parsed.data.deviceType, device_name: parsed.data.deviceName, can_manage_catalog: parsed.data.deviceType === "staff_terminal" && parsed.data.canManageCatalog, code_hash: codeHash, expires_at: new Date(Date.now()+600000).toISOString() }).select("id,expires_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "device_activation.created", organization_id: parsed.data.organizationId, store_id: parsed.data.storeId, details: { deviceType: parsed.data.deviceType, deviceName: parsed.data.deviceName } });
  return NextResponse.json({ id: data.id, code, expiresAt: data.expires_at }, { status: 201 });
}
