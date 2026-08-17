-- Unify kiosk and staff terminals into a single registered device model.
-- Existing device rows and catalog permissions are preserved.

drop policy if exists "staff device can read store intakes" on public.intakes;
drop policy if exists "staff device can read intake lines" on public.intake_lines;

alter table public.device_activations rename to device_licenses;
alter table public.device_licenses rename column code_hash to license_hash;
alter table public.device_licenses rename column used_at to redeemed_at;
alter table public.device_licenses rename column used_by_device_id to redeemed_by_device_id;
alter table public.device_licenses add column revoked_at timestamptz;

-- Do not revive legacy activation codes that had already expired.
update public.device_licenses
set revoked_at = now()
where redeemed_at is null
  and expires_at <= now();

alter table public.device_licenses drop column expires_at;
alter table public.device_licenses drop column device_type;
alter table public.devices drop column device_type;
alter table public.store_pins drop column failed_attempts;
alter table public.store_pins drop column locked_until;

drop type public.device_type;

create or replace function public.register_device_with_license(
  p_license_hash text,
  p_auth_user_id uuid
)
returns table(
  status text,
  device_id uuid,
  store_id uuid,
  can_manage_catalog boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.device_licenses%rowtype;
  v_device public.devices%rowtype;
  v_store_active boolean;
  v_organization_active boolean;
begin
  if exists (select 1 from public.devices d where d.auth_user_id = p_auth_user_id) then
    return query select 'already_registered'::text, null::uuid, null::uuid, false;
    return;
  end if;

  select *
  into v_license
  from public.device_licenses licenses
  where licenses.license_hash = p_license_hash
  for update;

  if v_license.id is null or v_license.revoked_at is not null then
    return query select 'invalid'::text, null::uuid, null::uuid, false;
    return;
  end if;

  if v_license.redeemed_at is not null then
    return query select 'redeemed'::text, null::uuid, null::uuid, false;
    return;
  end if;

  select s.active, o.active
  into v_store_active, v_organization_active
  from public.stores s
  join public.organizations o on o.id = s.organization_id
  where s.id = v_license.store_id
    and o.id = v_license.organization_id;

  if coalesce(v_store_active, false) is false or coalesce(v_organization_active, false) is false then
    return query select 'invalid'::text, null::uuid, null::uuid, false;
    return;
  end if;

  insert into public.devices(
    organization_id,
    store_id,
    auth_user_id,
    name,
    can_manage_catalog,
    active,
    last_seen_at
  )
  values(
    v_license.organization_id,
    v_license.store_id,
    p_auth_user_id,
    v_license.device_name,
    v_license.can_manage_catalog,
    true,
    now()
  )
  returning * into v_device;

  update public.device_licenses
  set redeemed_at = now(), redeemed_by_device_id = v_device.id
  where id = v_license.id;

  return query
  select 'registered'::text, v_device.id, v_device.store_id, v_device.can_manage_catalog;
end;
$$;

revoke all on function public.register_device_with_license(text, uuid) from public;
revoke all on function public.register_device_with_license(text, uuid) from anon;
revoke all on function public.register_device_with_license(text, uuid) from authenticated;
grant execute on function public.register_device_with_license(text, uuid) to service_role;

create or replace function public.submit_intake(p_submission jsonb, p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.devices%rowtype;
  v_release public.catalog_releases%rowtype;
  v_submission_release public.catalog_releases%rowtype;
  v_intake public.intakes%rowtype;
  v_number text;
  v_item text;
begin
  select * into v_device
  from public.devices
  where auth_user_id = p_auth_user_id and active
  limit 1;

  if v_device.id is null then
    raise exception 'active device required' using errcode = '42501';
  end if;

  select * into v_release
  from public.catalog_releases
  where store_id = v_device.store_id
  order by version desc
  limit 1;

  select * into v_submission_release
  from public.catalog_releases
  where store_id = v_device.store_id
    and resolved_catalog->>'releaseId' = p_submission->>'catalogReleaseId'
  limit 1;

  if v_submission_release.id is null then
    raise exception 'catalog release not found' using errcode = '23503';
  end if;

  select * into v_intake
  from public.intakes
  where store_id = v_device.store_id
    and client_submission_id = (p_submission->>'clientSubmissionId')::uuid;

  if v_intake.id is not null then
    return jsonb_build_object(
      'id', v_intake.id,
      'intakeNumber', v_intake.intake_number,
      'needsReview', v_intake.needs_review
    );
  end if;

  v_number := public.next_intake_number(v_device.store_id);

  insert into public.intakes(
    organization_id,
    store_id,
    device_id,
    client_submission_id,
    intake_number,
    catalog_release_id,
    catalog_release_ref,
    category_id,
    tier_id,
    product_id,
    pickup_id,
    customer_name,
    customer_phone,
    customer_request,
    privacy_consent_at,
    expected_total,
    selection_snapshot,
    needs_review
  )
  values(
    v_device.organization_id,
    v_device.store_id,
    v_device.id,
    (p_submission->>'clientSubmissionId')::uuid,
    v_number,
    v_submission_release.id,
    p_submission->>'catalogReleaseId',
    p_submission->>'categoryId',
    p_submission->>'tierId',
    p_submission->>'productId',
    p_submission->>'pickupId',
    p_submission#>>'{customer,name}',
    p_submission#>>'{customer,phone}',
    nullif(p_submission#>>'{customer,request}', ''),
    now(),
    nullif(p_submission->>'expectedTotal', '')::integer,
    p_submission->'selectionSnapshot',
    (p_submission->>'catalogReleaseId') is distinct from (v_release.resolved_catalog->>'releaseId')
  )
  returning * into v_intake;

  insert into public.intake_lines(intake_id, line_type, reference_id, label, unit_amount, snapshot)
  values(
    v_intake.id,
    'product',
    v_intake.product_id,
    coalesce(p_submission#>>'{selectionSnapshot,productName}', v_intake.product_id),
    nullif(p_submission#>>'{selectionSnapshot,productPrice,amount}', '')::integer,
    p_submission->'selectionSnapshot'
  );

  for v_item in select jsonb_array_elements_text(coalesce(p_submission->'addonIds', '[]'::jsonb)) loop
    insert into public.intake_lines(intake_id, line_type, reference_id, label, requested)
    values(v_intake.id, 'addon', v_item, v_item, true);
  end loop;

  for v_item in select jsonb_array_elements_text(coalesce(p_submission->'discountIds', '[]'::jsonb)) loop
    insert into public.intake_lines(intake_id, line_type, reference_id, label, requested, staff_approved)
    values(v_intake.id, 'discount', v_item, v_item, true, null);
  end loop;

  insert into public.intake_events(intake_id, store_id, actor_type, actor_device_id, event_type, to_value)
  values(
    v_intake.id,
    v_intake.store_id,
    'customer_device',
    v_device.id,
    'intake.created',
    jsonb_build_object('status', v_intake.status)
  );

  return jsonb_build_object(
    'id', v_intake.id,
    'intakeNumber', v_intake.intake_number,
    'needsReview', v_intake.needs_review
  );
end;
$$;
