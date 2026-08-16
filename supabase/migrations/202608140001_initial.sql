create extension if not exists pgcrypto;

create type public.device_type as enum ('kiosk', 'staff_terminal');
create type public.intake_status as enum ('pending_review', 'waiting_shoot', 'shooting', 'payment_waiting', 'completed', 'cancelled');
create type public.intake_line_type as enum ('product', 'addon', 'discount', 'pickup_surcharge');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  base_catalog jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  catalog_overrides jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  device_type public.device_type not null,
  name text not null,
  can_manage_catalog boolean not null default false,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_activations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  device_type public.device_type not null,
  device_name text not null,
  can_manage_catalog boolean not null default false,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device_id uuid references public.devices(id),
  created_at timestamptz not null default now()
);

create table public.store_pins (
  store_id uuid primary key references public.stores(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.catalog_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  catalog jsonb not null,
  revision integer not null default 1,
  updated_by_device_id uuid references public.devices(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, store_id)
);

create table public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  version integer not null,
  resolved_catalog jsonb not null,
  rollback_of_id uuid references public.catalog_releases(id),
  published_by_device_id uuid references public.devices(id),
  published_at timestamptz not null default now(),
  unique (store_id, version)
);

create table public.store_intake_counters (
  store_id uuid primary key references public.stores(id) on delete cascade,
  last_value bigint not null default 0
);

create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  device_id uuid not null references public.devices(id),
  client_submission_id uuid not null,
  intake_number text not null,
  status public.intake_status not null default 'pending_review',
  catalog_release_id uuid references public.catalog_releases(id),
  catalog_release_ref text not null,
  category_id text not null,
  tier_id text not null,
  product_id text not null,
  pickup_id text not null,
  customer_name text,
  customer_phone text,
  customer_request text,
  privacy_consent_at timestamptz not null,
  expected_total integer check (expected_total is null or expected_total >= 0),
  final_total integer check (final_total is null or final_total >= 0),
  selection_snapshot jsonb not null,
  needs_review boolean not null default false,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  pii_anonymized_at timestamptz,
  unique (store_id, client_submission_id),
  unique (store_id, intake_number)
);

create table public.intake_lines (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.intakes(id) on delete cascade,
  line_type public.intake_line_type not null,
  reference_id text not null,
  label text not null,
  unit_amount integer,
  requested boolean not null default true,
  staff_approved boolean,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.intake_events (
  id bigint generated always as identity primary key,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_type text not null check (actor_type in ('customer_device','staff_device','system')),
  actor_device_id uuid references public.devices(id),
  event_type text not null,
  from_value jsonb,
  to_value jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('operator','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  actor_type text not null,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.privacy_cleanup_runs (
  id bigint generated always as identity primary key,
  anonymized_count integer not null,
  run_at timestamptz not null default now()
);

create index intakes_store_created_idx on public.intakes(store_id, created_at desc);
create index intakes_store_status_idx on public.intakes(store_id, status, created_at desc);
create index catalog_releases_store_version_idx on public.catalog_releases(store_id, version desc);
create index catalog_releases_release_ref_idx on public.catalog_releases(store_id, (resolved_catalog->>'releaseId'));
create index devices_auth_user_idx on public.devices(auth_user_id) where active;

alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.devices enable row level security;
alter table public.device_activations enable row level security;
alter table public.store_pins enable row level security;
alter table public.catalog_drafts enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.store_intake_counters enable row level security;
alter table public.intakes enable row level security;
alter table public.intake_lines enable row level security;
alter table public.intake_events enable row level security;
alter table public.platform_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.privacy_cleanup_runs enable row level security;

create policy "device can read itself" on public.devices for select to authenticated using (auth_user_id = auth.uid() and active);
create policy "device can read its store" on public.stores for select to authenticated using (exists (select 1 from public.devices d where d.auth_user_id = auth.uid() and d.store_id = stores.id and d.active));
create policy "device can read current catalog releases" on public.catalog_releases for select to authenticated using (exists (select 1 from public.devices d where d.auth_user_id = auth.uid() and d.store_id = catalog_releases.store_id and d.active));
create policy "staff device can read store intakes" on public.intakes for select to authenticated using (exists (select 1 from public.devices d where d.auth_user_id = auth.uid() and d.store_id = intakes.store_id and d.device_type = 'staff_terminal' and d.active));
create policy "staff device can read intake lines" on public.intake_lines for select to authenticated using (exists (select 1 from public.intakes i join public.devices d on d.store_id = i.store_id where i.id = intake_lines.intake_id and d.auth_user_id = auth.uid() and d.device_type = 'staff_terminal' and d.active));
create policy "platform user can read own profile" on public.platform_users for select to authenticated using (auth_user_id = auth.uid() and active);

create or replace function public.next_intake_number(p_store_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare next_value bigint;
begin
  insert into public.store_intake_counters(store_id, last_value) values (p_store_id, 1)
  on conflict (store_id) do update set last_value = public.store_intake_counters.last_value + 1
  returning last_value into next_value;
  return 'A-' || lpad(next_value::text, 3, '0');
end; $$;

create or replace function public.submit_intake(p_submission jsonb, p_auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_device public.devices%rowtype; v_release public.catalog_releases%rowtype; v_submission_release public.catalog_releases%rowtype; v_intake public.intakes%rowtype; v_number text; v_item text;
begin
  select * into v_device from public.devices where auth_user_id = p_auth_user_id and device_type = 'kiosk' and active limit 1;
  if v_device.id is null then raise exception 'active kiosk device required' using errcode = '42501'; end if;
  select * into v_release from public.catalog_releases where store_id = v_device.store_id order by version desc limit 1;
  select * into v_submission_release from public.catalog_releases where store_id = v_device.store_id and resolved_catalog->>'releaseId' = p_submission->>'catalogReleaseId' limit 1;
  if v_submission_release.id is null then raise exception 'catalog release not found' using errcode = '23503'; end if;
  select * into v_intake from public.intakes where store_id = v_device.store_id and client_submission_id = (p_submission->>'clientSubmissionId')::uuid;
  if v_intake.id is not null then return jsonb_build_object('id', v_intake.id, 'intakeNumber', v_intake.intake_number, 'needsReview', v_intake.needs_review); end if;
  v_number := public.next_intake_number(v_device.store_id);
  insert into public.intakes(organization_id,store_id,device_id,client_submission_id,intake_number,catalog_release_id,catalog_release_ref,category_id,tier_id,product_id,pickup_id,customer_name,customer_phone,customer_request,privacy_consent_at,expected_total,selection_snapshot,needs_review)
  values(v_device.organization_id,v_device.store_id,v_device.id,(p_submission->>'clientSubmissionId')::uuid,v_number,v_submission_release.id,p_submission->>'catalogReleaseId',p_submission->>'categoryId',p_submission->>'tierId',p_submission->>'productId',p_submission->>'pickupId',p_submission#>>'{customer,name}',p_submission#>>'{customer,phone}',nullif(p_submission#>>'{customer,request}',''),now(),nullif(p_submission->>'expectedTotal','')::integer,p_submission->'selectionSnapshot',(p_submission->>'catalogReleaseId') is distinct from (v_release.resolved_catalog->>'releaseId')) returning * into v_intake;
  insert into public.intake_lines(intake_id,line_type,reference_id,label,unit_amount,snapshot) values(v_intake.id,'product',v_intake.product_id,coalesce(p_submission#>>'{selectionSnapshot,productName}',v_intake.product_id),nullif(p_submission#>>'{selectionSnapshot,productPrice,amount}','')::integer,p_submission->'selectionSnapshot');
  for v_item in select jsonb_array_elements_text(coalesce(p_submission->'addonIds','[]'::jsonb)) loop insert into public.intake_lines(intake_id,line_type,reference_id,label,requested) values(v_intake.id,'addon',v_item,v_item,true); end loop;
  for v_item in select jsonb_array_elements_text(coalesce(p_submission->'discountIds','[]'::jsonb)) loop insert into public.intake_lines(intake_id,line_type,reference_id,label,requested,staff_approved) values(v_intake.id,'discount',v_item,v_item,true,null); end loop;
  insert into public.intake_events(intake_id,store_id,actor_type,actor_device_id,event_type,to_value) values(v_intake.id,v_intake.store_id,'customer_device',v_device.id,'intake.created',jsonb_build_object('status',v_intake.status));
  return jsonb_build_object('id', v_intake.id, 'intakeNumber', v_intake.intake_number, 'needsReview', v_intake.needs_review);
end; $$;

create or replace function public.transition_intake_status(p_intake_id uuid, p_status public.intake_status, p_store_id uuid)
returns public.intakes language plpgsql security definer set search_path = public as $$
declare v_row public.intakes%rowtype; v_allowed boolean; v_from public.intake_status;
begin
  select * into v_row from public.intakes where id = p_intake_id and store_id = p_store_id for update;
  if v_row.id is null then raise exception 'intake not found'; end if;
  v_from := v_row.status;
  v_allowed := p_status = 'cancelled' or (v_row.status = 'pending_review' and p_status = 'waiting_shoot') or (v_row.status = 'waiting_shoot' and p_status = 'shooting') or (v_row.status = 'shooting' and p_status = 'payment_waiting') or (v_row.status = 'payment_waiting' and p_status = 'completed');
  if not v_allowed then raise exception 'invalid status transition'; end if;
  update public.intakes set status = p_status, updated_at = now(), completed_at = case when p_status = 'completed' then now() else completed_at end where id = p_intake_id returning * into v_row;
  insert into public.intake_events(intake_id,store_id,actor_type,event_type,from_value,to_value) values(v_row.id,v_row.store_id,'staff_device','status.changed',jsonb_build_object('status',v_from),jsonb_build_object('status',p_status));
  return v_row;
end; $$;

create or replace function public.anonymize_expired_intakes()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.intakes set customer_name = null, customer_phone = null, customer_request = null, privacy_consent_at = created_at, pii_anonymized_at = now(), updated_at = now() where created_at < now() - interval '7 days' and pii_anonymized_at is null;
  get diagnostics affected = row_count;
  insert into public.privacy_cleanup_runs(anonymized_count) values(affected);
  return affected;
end; $$;

revoke all on function public.submit_intake(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.submit_intake(jsonb,uuid) to service_role;
revoke all on function public.next_intake_number(uuid) from public, anon, authenticated;
grant execute on function public.next_intake_number(uuid) to service_role;
revoke all on function public.transition_intake_status(uuid,public.intake_status,uuid) from public, anon, authenticated;
grant execute on function public.transition_intake_status(uuid,public.intake_status,uuid) to service_role;
revoke all on function public.anonymize_expired_intakes() from public, anon, authenticated;
grant execute on function public.anonymize_expired_intakes() to service_role;

do $$ begin
  alter publication supabase_realtime add table public.intakes;
exception when duplicate_object then null;
end $$;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('anonymize-expired-intakes', '10 18 * * *', 'select public.anonymize_expired_intakes()');
exception when others then
  raise notice 'pg_cron is unavailable; schedule anonymize_expired_intakes externally';
end $$;

