import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { catalogSchema } from "@/lib/catalog/schema";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session?.canManageCatalog) return NextResponse.json({ error: "상품 관리 권한이 없어요." }, { status: 403 });
  if (isDemoMode) return NextResponse.json(demoDb.catalog);
  const admin = createAdminClient();
  const { data, error } = await admin.from("catalog_releases").select("resolved_catalog").eq("store_id", session.storeId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const parsed = catalogSchema.safeParse(data?.resolved_catalog);
  return parsed.success ? NextResponse.json(parsed.data) : NextResponse.json({ error: "운영 카탈로그가 올바르지 않아요." }, { status: 500 });
}
