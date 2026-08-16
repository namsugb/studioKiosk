import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { catalogSchema } from "@/lib/catalog/schema";

export async function POST(request: Request) {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session?.canManageCatalog) return NextResponse.json({ error: "상품 관리 권한이 없어요." }, { status: 403 });
  const parsed = z.object({ releaseId: z.string() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "버전을 선택해 주세요." }, { status: 400 });
  if (isDemoMode) { const source = demoDb.releases.find((item) => item.releaseId === parsed.data.releaseId); if (!source) return NextResponse.json({ error: "버전을 찾을 수 없어요." }, { status: 404 }); const release = { ...source, releaseId: crypto.randomUUID(), version: demoDb.catalog.version + 1, publishedAt: new Date().toISOString() }; demoDb.catalog = release; demoDb.releases.push(release); return NextResponse.json(release); }
  const admin = createAdminClient();
  const { data: source } = await admin.from("catalog_releases").select("organization_id,resolved_catalog").eq("id", parsed.data.releaseId).eq("store_id", session.storeId).single();
  if (!source) return NextResponse.json({ error: "버전을 찾을 수 없어요." }, { status: 404 });
  const sourceCatalog = catalogSchema.safeParse(source.resolved_catalog);
  if (!sourceCatalog.success) return NextResponse.json({ error: "이전 카탈로그 데이터가 올바르지 않아요." }, { status: 500 });
  const { data: latest } = await admin.from("catalog_releases").select("version").eq("store_id", session.storeId).order("version", { ascending: false }).limit(1).maybeSingle();
  const release = { ...sourceCatalog.data, releaseId: crypto.randomUUID(), version: (latest?.version ?? 0) + 1, publishedAt: new Date().toISOString() };
  const { error } = await admin.from("catalog_releases").insert({ organization_id: source.organization_id, store_id: session.storeId, version: release.version, resolved_catalog: release, rollback_of_id: parsed.data.releaseId, published_by_device_id: session.deviceId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({ organization_id: source.organization_id, store_id: session.storeId, actor_type: "staff_device", actor_id: session.deviceId, action: "catalog.rolled_back", details: { sourceReleaseId: parsed.data.releaseId, version: release.version } });
  return NextResponse.json(release);
}
