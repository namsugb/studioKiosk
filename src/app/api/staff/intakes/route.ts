import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { demoDb } from "@/lib/repositories/demo-store";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { serializeDatabaseIntake } from "@/lib/intakes/serialize";

export async function GET() {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session) return NextResponse.json({ error: "잠금 해제가 필요해요." }, { status: 401 });
  if (isDemoMode) return NextResponse.json({ storeId: session.storeId, intakes: demoDb.intakes });
  const supabase = createAdminClient(); const start = new Date(); start.setHours(0,0,0,0);
  const { data, error } = await supabase.from("intakes").select("*, intake_lines(*)").eq("store_id", session.storeId).gte("created_at", start.toISOString()).order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ storeId: session.storeId, intakes: (data ?? []).map(serializeDatabaseIntake) });
}
