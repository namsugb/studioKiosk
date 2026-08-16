import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStaffSession } from "@/lib/auth/staff-session";
import { isDemoMode } from "@/lib/config";
import { serializeDatabaseIntake } from "@/lib/intakes/serialize";
import { updateDemoIntake } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  finalTotal: z.number().int().nonnegative().nullable().optional(),
  internalNote: z.string().max(500).optional(),
  discountApprovedIds: z.array(z.string().min(1).max(80)).max(20).optional(),
  pickupId: z.string().min(1).max(80).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "수정 내용을 확인해 주세요." }, { status: 400 });
  const { id } = await params;
  if (isDemoMode) {
    const updated = updateDemoIntake(id, body.data);
    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "접수를 찾을 수 없어요." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("intakes").select("id,organization_id,store_id,final_total,internal_note,pickup_id").eq("id", id).eq("store_id", session.storeId).single();
  if (!existing) return NextResponse.json({ error: "접수를 찾을 수 없어요." }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.finalTotal !== undefined) update.final_total = body.data.finalTotal;
  if (body.data.internalNote !== undefined) update.internal_note = body.data.internalNote;
  if (body.data.pickupId !== undefined) update.pickup_id = body.data.pickupId;
  const { error: updateError } = await admin.from("intakes").update(update).eq("id", id).eq("store_id", session.storeId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (body.data.discountApprovedIds) {
    const { error: resetError } = await admin.from("intake_lines").update({ staff_approved: false }).eq("intake_id", id).eq("line_type", "discount");
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 });
    if (body.data.discountApprovedIds.length) {
      const { error: approveError } = await admin.from("intake_lines").update({ staff_approved: true }).eq("intake_id", id).eq("line_type", "discount").in("reference_id", body.data.discountApprovedIds);
      if (approveError) return NextResponse.json({ error: approveError.message }, { status: 500 });
    }
  }

  await admin.from("intake_events").insert({
    intake_id: id,
    store_id: session.storeId,
    actor_type: "staff_device",
    actor_device_id: session.deviceId,
    event_type: "intake.updated",
    from_value: { finalTotal: existing.final_total, internalNote: existing.internal_note, pickupId: existing.pickup_id },
    to_value: body.data,
  });
  const { data: updated, error: readError } = await admin.from("intakes").select("*, intake_lines(*)").eq("id", id).eq("store_id", session.storeId).single();
  return readError ? NextResponse.json({ error: readError.message }, { status: 500 }) : NextResponse.json(serializeDatabaseIntake(updated));
}