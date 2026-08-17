import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("device"), id: z.string().uuid(), action: z.literal("deactivate") }),
  z.object({ kind: z.literal("license"), id: z.string().uuid(), action: z.literal("revoke") }),
]);

export async function GET() {
  if (isDemoMode) return NextResponse.json({ devices: [], pendingLicenses: [] });
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  const [devicesResult, licensesResult] = await Promise.all([
    admin.from("devices").select("id,organization_id,store_id,name,can_manage_catalog,active,last_seen_at,created_at").order("created_at", { ascending: false }),
    admin.from("device_licenses").select("id,organization_id,store_id,device_name,can_manage_catalog,redeemed_at,revoked_at,created_at").is("redeemed_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  if (devicesResult.error || licensesResult.error) return NextResponse.json({ error: devicesResult.error?.message ?? licensesResult.error?.message ?? "기기 목록을 불러오지 못했어요." }, { status: 500 });
  return NextResponse.json({
    devices: (devicesResult.data ?? []).map((device) => ({
      id: device.id,
      organizationId: device.organization_id,
      storeId: device.store_id,
      name: device.name,
      canManageCatalog: device.can_manage_catalog,
      active: device.active,
      lastSeenAt: device.last_seen_at,
      createdAt: device.created_at,
    })),
    pendingLicenses: (licensesResult.data ?? []).map((license) => ({
      id: license.id,
      organizationId: license.organization_id,
      storeId: license.store_id,
      deviceName: license.device_name,
      canManageCatalog: license.can_manage_catalog,
      createdAt: license.created_at,
    })),
  });
}

export async function PATCH(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "처리할 기기 정보를 확인해 주세요." }, { status: 400 });
  if (isDemoMode) return NextResponse.json({ ok: true });
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  if (parsed.data.kind === "device") {
    const { data: device } = await admin.from("devices").select("organization_id,store_id,name").eq("id", parsed.data.id).single();
    if (!device) return NextResponse.json({ error: "기기를 찾을 수 없어요." }, { status: 404 });
    const { error } = await admin.from("devices").update({ active: false }).eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: "기기를 비활성화하지 못했어요." }, { status: 500 });
    await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "device.deactivated", organization_id: device.organization_id, store_id: device.store_id, details: { deviceId: parsed.data.id, deviceName: device.name } });
    return NextResponse.json({ ok: true });
  }
  const { data: license } = await admin.from("device_licenses").select("organization_id,store_id,device_name").eq("id", parsed.data.id).is("redeemed_at", null).is("revoked_at", null).single();
  if (!license) return NextResponse.json({ error: "등록 대기 코드를 찾을 수 없어요." }, { status: 404 });
  const { error } = await admin.from("device_licenses").update({ revoked_at: new Date().toISOString() }).eq("id", parsed.data.id).is("redeemed_at", null);
  if (error) return NextResponse.json({ error: "등록 코드를 폐기하지 못했어요." }, { status: 500 });
  await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "device_license.revoked", organization_id: license.organization_id, store_id: license.store_id, details: { licenseId: parsed.data.id, deviceName: license.device_name } });
  return NextResponse.json({ ok: true });
}
