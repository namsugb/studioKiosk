import { NextResponse } from "next/server";
import { bearerToken, resolveActiveDevice } from "@/lib/auth/device-server";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";

export async function GET(request: Request) {
  if (isDemoMode) return NextResponse.json(demoDb.catalog);
  const resolved = await resolveActiveDevice(bearerToken(request), request.headers.get("x-device-id"));
  if (!resolved) return NextResponse.json({ error: "등록된 기기가 아니에요." }, { status: 403 });
  const { admin, device } = resolved;
  const { data, error } = await admin.from("catalog_releases").select("resolved_catalog").eq("store_id", device.store_id).order("version", { ascending: false }).limit(1).single();
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data.resolved_catalog);
}