import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { catalogSchema } from "@/lib/catalog/schema";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session?.canManageCatalog) return NextResponse.json({ error: "상품 관리 권한이 없어요." }, { status: 403 });
  const parsed = catalogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "상품 설정을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  if (isDemoMode) {
    const release = { ...parsed.data, releaseId: crypto.randomUUID(), version: demoDb.catalog.version + 1, publishedAt: new Date().toISOString() };
    demoDb.catalog = release; demoDb.releases.push(release); return NextResponse.json(release);
  }
  const admin = createAdminClient();
  const { data: device } = await admin.from("devices").select("organization_id").eq("id", session.deviceId).eq("store_id", session.storeId).eq("active", true).single();
  if (!device) return NextResponse.json({ error: "등록된 기기를 찾을 수 없어요." }, { status: 403 });
  const { data: latest } = await admin.from("catalog_releases").select("version").eq("store_id", session.storeId).order("version", { ascending: false }).limit(1).maybeSingle();
  const release = { ...parsed.data, releaseId: crypto.randomUUID(), version: (latest?.version ?? 0) + 1, publishedAt: new Date().toISOString() };
  const { error } = await admin.from("catalog_releases").insert({ organization_id: device.organization_id, store_id: session.storeId, version: release.version, resolved_catalog: release, published_by_device_id: session.deviceId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({ organization_id: device.organization_id, store_id: session.storeId, actor_type: "staff_device", actor_id: session.deviceId, action: "catalog.published", details: { version: release.version, releaseId: release.releaseId } });
  return NextResponse.json(release);
}
