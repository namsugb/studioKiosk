import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { intakeStatusSchema } from "@/lib/intakes/types";
import { isDemoMode } from "@/lib/config";
import { updateDemoStatus } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { serializeDatabaseIntake } from "@/lib/intakes/serialize";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value); if (!session) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const parsed = intakeStatusSchema.safeParse((await request.json().catch(() => null))?.status); if (!parsed.success) return NextResponse.json({ error: "상태를 확인해 주세요." }, { status: 400 });
  const { id } = await params;
  if (isDemoMode) { const updated = updateDemoStatus(id, parsed.data); return updated ? NextResponse.json(updated) : NextResponse.json({ error: "접수를 찾을 수 없어요." }, { status: 404 }); }
  const supabase = createAdminClient(); const { error } = await supabase.rpc("transition_intake_status", { p_intake_id: id, p_status: parsed.data, p_store_id: session.storeId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: updated, error: readError } = await supabase.from("intakes").select("*, intake_lines(*)").eq("id", id).eq("store_id", session.storeId).single();
  return readError ? NextResponse.json({ error: readError.message }, { status: 500 }) : NextResponse.json(serializeDatabaseIntake(updated));
}
