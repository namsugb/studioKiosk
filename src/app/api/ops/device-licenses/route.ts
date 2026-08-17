import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  organizationId: z.string().min(1),
  storeId: z.string().min(1),
  deviceName: z.string().trim().min(2).max(80),
  canManageCatalog: z.boolean().default(false),
});

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const normalizeLicense = (value: string) => value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
const formatLicense = (value: string) => normalizeLicense(value).match(/.{1,4}/g)?.join("-") ?? value;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "기기 정보를 확인해 주세요." }, { status: 400 });

  if (isDemoMode) {
    const configured = process.env.DEMO_DEVICE_LICENSE;
    if (!configured) return NextResponse.json({ error: "DEMO_DEVICE_LICENSE를 설정해 주세요." }, { status: 503 });
    return NextResponse.json({ id: "demo-license", licenseKey: formatLicense(configured) }, { status: 201 });
  }

  if (!z.string().uuid().safeParse(parsed.data.organizationId).success || !z.string().uuid().safeParse(parsed.data.storeId).success) {
    return NextResponse.json({ error: "사진관과 지점 식별자를 확인해 주세요." }, { status: 400 });
  }

  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });

  const admin = createAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id,organization_id")
    .eq("id", parsed.data.storeId)
    .eq("organization_id", parsed.data.organizationId)
    .eq("active", true)
    .single();
  if (!store) return NextResponse.json({ error: "지점을 찾을 수 없어요." }, { status: 404 });

  const rawLicense = Array.from(randomBytes(12), (value) => alphabet[value % alphabet.length]).join("");
  const licenseHash = createHash("sha256").update(rawLicense).digest("hex");
  const { data, error } = await admin
    .from("device_licenses")
    .insert({
      organization_id: parsed.data.organizationId,
      store_id: parsed.data.storeId,
      device_name: parsed.data.deviceName,
      can_manage_catalog: parsed.data.canManageCatalog,
      license_hash: licenseHash,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "기기 라이선스를 발급하지 못했어요." }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_type: "platform_user",
    actor_id: user.id,
    action: "device_license.created",
    organization_id: parsed.data.organizationId,
    store_id: parsed.data.storeId,
    details: { deviceName: parsed.data.deviceName, canManageCatalog: parsed.data.canManageCatalog },
  });

  return NextResponse.json({ id: data.id, licenseKey: formatLicense(rawLicense) }, { status: 201 });
}
