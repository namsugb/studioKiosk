import { hash } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { defaultCatalog } from "@/lib/catalog/defaults";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  storeName: z.string().trim().min(1).max(80).default("본점"),
  pin: z.string().regex(/^\d{4,8}$/),
});

export async function GET() {
  if (isDemoMode) return NextResponse.json(demoDb.organizations.map((organization) => ({ ...organization, storeId: "demo-store" })));
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id,name,stores(id,name),devices(count)").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((row) => {
    const stores = Array.isArray(row.stores) ? row.stores : [];
    const deviceCount = Array.isArray(row.devices) && row.devices[0] && typeof row.devices[0].count === "number" ? row.devices[0].count : 0;
    return { id: row.id, name: row.name, stores: stores.length, devices: deviceCount, storeId: stores[0]?.id ?? null };
  }));
}

export async function POST(request: Request) {
  const body = organizationSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "사진관 정보와 4~8자리 PIN을 확인해 주세요." }, { status: 400 });
  if (isDemoMode) {
    const organization = { id: crypto.randomUUID(), name: body.data.name, stores: 1, devices: 0 };
    demoDb.organizations.push(organization);
    return NextResponse.json({ ...organization, storeId: "demo-store" }, { status: 201 });
  }
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const catalog = { ...structuredClone(defaultCatalog), releaseId: crypto.randomUUID(), publishedAt: now, studio: { ...defaultCatalog.studio, name: body.data.name } };
  const { data: organization, error: organizationError } = await admin.from("organizations").insert({ name: body.data.name, base_catalog: catalog }).select("id,name").single();
  if (organizationError) return NextResponse.json({ error: organizationError.message }, { status: 500 });

  const cleanup = async () => { await admin.from("organizations").delete().eq("id", organization.id); };
  const slug = `studio-${crypto.randomUUID()}`;
  const { data: store, error: storeError } = await admin.from("stores").insert({ organization_id: organization.id, name: body.data.storeName, slug }).select("id,name").single();
  if (storeError) { await cleanup(); return NextResponse.json({ error: storeError.message }, { status: 500 }); }
  const pinHash = await hash(body.data.pin);
  const { error: pinError } = await admin.from("store_pins").insert({ store_id: store.id, pin_hash: pinHash });
  if (pinError) { await cleanup(); return NextResponse.json({ error: pinError.message }, { status: 500 }); }
  const { error: releaseError } = await admin.from("catalog_releases").insert({ organization_id: organization.id, store_id: store.id, version: 1, resolved_catalog: catalog });
  if (releaseError) { await cleanup(); return NextResponse.json({ error: releaseError.message }, { status: 500 }); }
  await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "organization.created", organization_id: organization.id, store_id: store.id, details: { name: body.data.name, storeName: body.data.storeName } });
  return NextResponse.json({ id: organization.id, name: organization.name, stores: 1, devices: 0, storeId: store.id }, { status: 201 });
}