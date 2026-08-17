import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { defaultCatalog } from "@/lib/catalog/defaults";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

const organizationSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function GET() {
  if (isDemoMode) return NextResponse.json(demoDb.organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    stores: Array.isArray(organization.storeItems) ? organization.storeItems : [],
  })));
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id,name,stores(id,name,devices(count))").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    stores: (Array.isArray(row.stores) ? row.stores : []).map((store) => ({
      id: store.id,
      name: store.name,
      devices: Array.isArray(store.devices) && store.devices[0] ? Number(store.devices[0].count) : 0,
    })),
  })));
}

export async function POST(request: Request) {
  const body = organizationSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "고객 이름을 확인해 주세요." }, { status: 400 });
  if (isDemoMode) {
    const organization = { id: crypto.randomUUID(), name: body.data.name, stores: 0, devices: 0, storeItems: [] };
    demoDb.organizations.push(organization);
    return NextResponse.json({ id: organization.id, name: organization.name, stores: [] }, { status: 201 });
  }
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").insert({ name: body.data.name, base_catalog: structuredClone(defaultCatalog) }).select("id,name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "organization.created", organization_id: data.id, details: { name: data.name } });
  return NextResponse.json({ ...data, stores: [] }, { status: 201 });
}
