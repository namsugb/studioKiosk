import { NextResponse } from "next/server";
import { bearerToken, resolveActiveDevice } from "@/lib/auth/device-server";
import { catalogSchema } from "@/lib/catalog/schema";
import { validateSubmissionAgainstCatalog } from "@/lib/catalog/validate-submission";
import { isDemoMode } from "@/lib/config";
import { intakeSubmissionSchema } from "@/lib/intakes/types";
import { addDemoIntake, demoDb } from "@/lib/repositories/demo-store";

export async function POST(request: Request) {
  const parsed = intakeSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "입력 내용을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  if (isDemoMode) {
    const validated = validateSubmissionAgainstCatalog(demoDb.catalog, parsed.data);
    if (!validated.success) return NextResponse.json({ error: validated.error }, { status: 400 });
    const intake = addDemoIntake(validated.submission);
    return NextResponse.json({ id: intake.id, intakeNumber: intake.intakeNumber, needsReview: intake.needsReview }, { status: 201 });
  }

  const resolved = await resolveActiveDevice(bearerToken(request), request.headers.get("x-device-id"));
  if (!resolved) return NextResponse.json({ error: "등록된 기기가 필요해요." }, { status: 403 });
  const { admin, device, userId } = resolved;
  const { data: release } = await admin.from("catalog_releases").select("resolved_catalog").eq("store_id", device.store_id).contains("resolved_catalog", { releaseId: parsed.data.catalogReleaseId }).limit(1).maybeSingle();
  if (!release) return NextResponse.json({ error: "접수에 사용한 카탈로그 버전을 찾을 수 없어요. 온라인에서 상품을 다시 불러와 주세요." }, { status: 409 });
  const catalog = catalogSchema.safeParse(release.resolved_catalog);
  if (!catalog.success) return NextResponse.json({ error: "카탈로그 데이터가 올바르지 않아요." }, { status: 500 });
  const validated = validateSubmissionAgainstCatalog(catalog.data, parsed.data);
  if (!validated.success) return NextResponse.json({ error: validated.error }, { status: 400 });
  const { data, error } = await admin.rpc("submit_intake", { p_submission: validated.submission, p_auth_user_id: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json(data, { status: 201 });
}