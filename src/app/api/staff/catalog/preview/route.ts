import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { catalogSchema } from "@/lib/catalog/schema";
import { verifyStaffSession } from "@/lib/auth/staff-session";

export async function POST(request: Request) {
  const session = await verifyStaffSession((await cookies()).get("staff_session")?.value);
  if (!session?.canManageCatalog) return NextResponse.json({ error: "상품 관리 권한이 없어요." }, { status: 403 });
  const parsed = catalogSchema.safeParse(await request.json().catch(() => null));
  return parsed.success ? NextResponse.json({ valid: true, resolvedCatalog: parsed.data }) : NextResponse.json({ valid: false, issues: parsed.error.flatten() }, { status: 400 });
}
