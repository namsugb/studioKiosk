import { NextResponse } from "next/server";
import { demoDb } from "@/lib/repositories/demo-store";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (isDemoMode) return NextResponse.json(demoDb.catalog);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) return NextResponse.json({ error: "기기 활성화가 필요해요." }, { status: 401 });
  const admin = createAdminClient(); const { data: userData } = await admin.auth.getUser(token); if (!userData.user) return NextResponse.json({ error: "기기 세션이 만료됐어요." }, { status: 401 });
  const { data: device } = await admin.from("devices").select("store_id").eq("auth_user_id", userData.user.id).eq("active", true).single(); if (!device) return NextResponse.json({ error: "등록된 기기가 아니에요." }, { status: 403 });
  const { data, error } = await admin.from("catalog_releases").select("resolved_catalog").eq("store_id", device.store_id).order("version", { ascending: false }).limit(1).single();
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data.resolved_catalog);
}
