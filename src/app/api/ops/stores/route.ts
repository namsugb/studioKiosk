import { hash } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformUser } from "@/lib/auth/platform";
import { defaultCatalog } from "@/lib/catalog/defaults";
import { isDemoMode } from "@/lib/config";
import { demoDb } from "@/lib/repositories/demo-store";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{4,8}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "사진관 이름과 4~8자리 PIN을 확인해 주세요." }, { status: 400 });
  if (isDemoMode) {
    const organization = demoDb.organizations.find((item) => item.id === parsed.data.organizationId);
    if (!organization) return NextResponse.json({ error: "고객을 찾을 수 없어요." }, { status: 404 });
    const store = { id: crypto.randomUUID(), name: parsed.data.name, devices: 0 };
    organization.storeItems ??= [];
    organization.storeItems.push(store);
    organization.stores = organization.storeItems.length;
    return NextResponse.json(store, { status: 201 });
  }
  if (!z.string().uuid().safeParse(parsed.data.organizationId).success) return NextResponse.json({ error: "고객 식별자를 확인해 주세요." }, { status: 400 });
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id,name,base_catalog").eq("id", parsed.data.organizationId).eq("active", true).single();
  if (!organization) return NextResponse.json({ error: "고객을 찾을 수 없어요." }, { status: 404 });
  const catalog = { ...structuredClone(organization.base_catalog ?? defaultCatalog), releaseId: crypto.randomUUID(), publishedAt: new Date().toISOString(), studio: { ...(organization.base_catalog ?? defaultCatalog).studio, name: parsed.data.name } };
  const { data: store, error: storeError } = await admin.from("stores").insert({ organization_id: organization.id, name: parsed.data.name, slug: `studio-${crypto.randomUUID()}` }).select("id,name").single();
  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  const cleanup = async () => { await admin.from("stores").delete().eq("id", store.id); };
  const { error: pinError } = await admin.from("store_pins").insert({ store_id: store.id, pin_hash: await hash(parsed.data.pin) });
  if (pinError) { await cleanup(); return NextResponse.json({ error: pinError.message }, { status: 500 }); }
  const { error: releaseError } = await admin.from("catalog_releases").insert({ organization_id: organization.id, store_id: store.id, version: 1, resolved_catalog: catalog });
  if (releaseError) { await cleanup(); return NextResponse.json({ error: releaseError.message }, { status: 500 }); }
  await admin.from("audit_logs").insert({ actor_type: "platform_user", actor_id: user.id, action: "store.created", organization_id: organization.id, store_id: store.id, details: { name: store.name } });
  return NextResponse.json({ ...store, devices: 0 }, { status: 201 });
}
