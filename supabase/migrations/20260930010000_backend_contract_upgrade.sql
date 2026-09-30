-- Rider Shoes production backend contract upgrade.
-- This migration is intentionally additive; the 20260930000000 foundation is
-- retained as the reproducible base schema.

begin;

/* -------------------------------------------------------------------------- */
/* Order, inventory, payment, and notification state.                         */
/* -------------------------------------------------------------------------- */

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in (
    'pending', 'payment_pending', 'confirmed', 'processing', 'packed',
    'shipped', 'out_for_delivery', 'delivered', 'cancelled',
    'refund_requested', 'returned', 'refunded'
  ));

alter table public.orders
  add column if not exists checkout_idempotency_key uuid;

create unique index if not exists orders_profile_checkout_idempotency_idx
  on public.orders (profile_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

alter table public.coupon_redemptions
  add column if not exists status text not null default 'redeemed',
  add column if not exists released_at timestamptz;
alter table public.coupon_redemptions
  drop constraint if exists coupon_redemptions_status_check;
alter table public.coupon_redemptions
  add constraint coupon_redemptions_status_check
  check (status in ('reserved', 'redeemed', 'released'));

create table public.order_number_sequences (
  sequence_year smallint primary key check (sequence_year between 2020 and 9999),
  last_value bigint not null check (last_value > 0),
  updated_at timestamptz not null default now()
);

create table public.order_inventory_allocations (
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  state text not null check (state in ('reserved', 'committed', 'released', 'restored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (order_id, variant_id)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  source text not null default 'system' check (source in ('checkout', 'staff', 'payment', 'expiry', 'system')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.payment_initializations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  state text not null default 'claimed' check (state in ('claimed', 'ready', 'failed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_order_id text,
  payment_id uuid references public.payments(id) on delete set null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_application_events (
  event_key text primary key check (length(event_key) between 1 and 220),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider_payment_id text,
  provider_status text not null,
  result jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create table public.order_event_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'suppressed')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_type)
);

create table public.order_notification_templates (
  event_type text primary key,
  template_id uuid not null references public.whatsapp_templates(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_notification_templates_event_check check (event_type in (
    'order.created', 'order.confirmed', 'order.packed',
    'order.out_for_delivery', 'order.delivered', 'order.cancelled',
    'order.refund_requested', 'payment.captured',
    'payment.captured_after_cancellation', 'payment.refunded'
  ))
);

create index order_inventory_allocations_variant_idx
  on public.order_inventory_allocations (variant_id, state);
create index order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at);
create index payment_application_events_order_idx
  on public.payment_application_events (order_id, processed_at desc);
create index order_event_notifications_dispatch_idx
  on public.order_event_notifications (status, available_at, created_at);
create index order_event_notifications_profile_created_idx
  on public.order_event_notifications (profile_id, created_at desc);
create unique index payments_one_razorpay_session_per_order_idx
  on public.payments (order_id)
  where provider = 'razorpay';

create trigger order_inventory_allocations_set_updated_at
before update on public.order_inventory_allocations
for each row execute function public.set_updated_at();
create trigger payment_initializations_set_updated_at
before update on public.payment_initializations
for each row execute function public.set_updated_at();
create trigger order_event_notifications_set_updated_at
before update on public.order_event_notifications
for each row execute function public.set_updated_at();
create trigger order_notification_templates_set_updated_at
before update on public.order_notification_templates
for each row execute function public.set_updated_at();

/* Annual, gap-tolerant, concurrency-safe customer order numbers. */
create or replace function public.generate_order_number()
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  number_year smallint := extract(year from now())::smallint;
  next_number bigint;
begin
  insert into public.order_number_sequences (sequence_year, last_value)
  values (number_year, 1)
  on conflict (sequence_year) do update
    set last_value = public.order_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into next_number;

  return 'RS-' || number_year::text || '-' || lpad(next_number::text, 6, '0');
end;
$$;

/* -------------------------------------------------------------------------- */
/* Active-account authorization and requested operational roles.              */
/* -------------------------------------------------------------------------- */

create or replace function public.has_role(_role_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles profile
    join public.profile_roles profile_role on profile_role.profile_id = profile.id
    join public.roles role_record on role_record.id = profile_role.role_id
    where profile.id = auth.uid()
      and profile.is_active
      and role_record.is_active
      and role_record.code = lower(trim(_role_code))
  );
$$;

create or replace function public.has_permission(_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles profile
    join public.profile_roles profile_role on profile_role.profile_id = profile.id
    join public.roles role_record on role_record.id = profile_role.role_id
    join public.role_permissions role_permission on role_permission.role_id = role_record.id
    join public.permissions permission_record on permission_record.id = role_permission.permission_id
    where profile.id = auth.uid()
      and profile.is_active
      and role_record.is_active
      and permission_record.code = lower(trim(_permission_code))
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles profile
    join public.profile_roles profile_role on profile_role.profile_id = profile.id
    join public.roles role_record on role_record.id = profile_role.role_id
    where profile.id = auth.uid()
      and profile.is_active
      and role_record.is_active
      and role_record.code in (
        'owner', 'admin', 'manager', 'staff', 'order_manager', 'inventory_manager'
      )
  );
$$;

create or replace function public._profile_has_permission(
  _profile_id uuid,
  _permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select _profile_id is not null and exists (
    select 1
    from public.profiles profile
    join public.profile_roles profile_role on profile_role.profile_id = profile.id
    join public.roles role_record on role_record.id = profile_role.role_id
    join public.role_permissions role_permission on role_permission.role_id = role_record.id
    join public.permissions permission_record on permission_record.id = role_permission.permission_id
    where profile.id = _profile_id
      and profile.is_active
      and role_record.is_active
      and permission_record.code = lower(trim(_permission_code))
  );
$$;

create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.uid() is null or not exists (
      select 1 from public.profiles where id = auth.uid() and is_active
    ) then jsonb_build_object('roles', '[]'::jsonb, 'permissions', '[]'::jsonb)
    else jsonb_build_object(
      'roles', coalesce((
        select jsonb_agg(role_code order by role_code)
        from (
          select distinct role_record.code as role_code
          from public.profile_roles profile_role
          join public.roles role_record on role_record.id = profile_role.role_id
          where profile_role.profile_id = auth.uid() and role_record.is_active
        ) roles_for_user
      ), '[]'::jsonb),
      'permissions', coalesce((
        select jsonb_agg(permission_code order by permission_code)
        from (
          select distinct permission_record.code as permission_code
          from public.profile_roles profile_role
          join public.roles role_record on role_record.id = profile_role.role_id
          join public.role_permissions role_permission on role_permission.role_id = role_record.id
          join public.permissions permission_record on permission_record.id = role_permission.permission_id
          where profile_role.profile_id = auth.uid() and role_record.is_active
        ) permissions_for_user
      ), '[]'::jsonb)
    )
  end;
$$;

insert into public.roles (code, name, description, is_active)
values
  ('owner', 'Super Admin', 'Full access, including role administration', true),
  ('admin', 'Admin', 'All store operations except assigning privileged roles', true),
  ('manager', 'Manager', 'Manages catalog, inventory, orders, settings, and reporting', true),
  ('staff', 'Staff', 'Read-only access to all orders', true),
  ('order_manager', 'Order Manager', 'Manages order fulfillment and customer updates', true),
  ('inventory_manager', 'Inventory Manager', 'Manages catalog inventory and product records', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

update public.roles
set is_active = false
where code in ('support', 'fulfillment');

delete from public.role_permissions
where role_id in (
  select id from public.roles
  where code in ('owner', 'admin', 'manager', 'staff', 'order_manager', 'inventory_manager')
);

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
cross join public.permissions permission_record
where role_record.code = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
join public.permissions permission_record on permission_record.code <> 'roles.manage'
where role_record.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
join public.permissions permission_record on permission_record.code in (
  'catalog.manage', 'inventory.manage', 'orders.read_all', 'orders.manage',
  'payments.manage', 'discounts.manage', 'delivery.manage', 'settings.manage',
  'profiles.read_all', 'notifications.send', 'analytics.read'
)
where role_record.code = 'manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
join public.permissions permission_record on permission_record.code = 'orders.read_all'
where role_record.code = 'staff'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
join public.permissions permission_record on permission_record.code in (
  'orders.read_all', 'orders.manage', 'profiles.read_all', 'notifications.send'
)
where role_record.code = 'order_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select role_record.id, permission_record.id
from public.roles role_record
join public.permissions permission_record on permission_record.code in (
  'catalog.manage', 'inventory.manage'
)
where role_record.code = 'inventory_manager'
on conflict do nothing;

create or replace function public.set_profile_roles(
  _profile_id uuid,
  _role_codes text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_codes text[];
  owner_role_id uuid;
  target_is_owner boolean;
begin
  if not public.has_permission('roles.manage') then
    raise exception using errcode = '42501', message = 'Role management permission required';
  end if;
  if _profile_id is null or not exists (
    select 1 from public.profiles where id = _profile_id and is_active
  ) then
    raise exception using errcode = 'P0002', message = 'Active profile not found';
  end if;

  select coalesce(array_agg(distinct lower(trim(code))), '{}'::text[])
  into requested_codes
  from unnest(coalesce(_role_codes, '{}'::text[])) code
  where trim(code) <> '';

  if exists (
    select 1 from unnest(requested_codes) requested(code)
    where not exists (
      select 1 from public.roles role_record
      where role_record.code = requested.code and role_record.is_active
    )
  ) then
    raise exception using errcode = '22023', message = 'Unknown or inactive role requested';
  end if;

  select id into owner_role_id from public.roles where code = 'owner' and is_active;
  select exists (
    select 1 from public.profile_roles
    where profile_id = _profile_id and role_id = owner_role_id
  ) into target_is_owner;

  if target_is_owner and not ('owner' = any(requested_codes)) and (
    select count(*) from public.profile_roles profile_role
    join public.profiles profile on profile.id = profile_role.profile_id and profile.is_active
    where profile_role.role_id = owner_role_id
  ) <= 1 then
    raise exception using errcode = '23514', message = 'The final active Super Admin cannot be removed';
  end if;

  delete from public.profile_roles where profile_id = _profile_id;
  insert into public.profile_roles (profile_id, role_id, assigned_by)
  select _profile_id, role_record.id, auth.uid()
  from public.roles role_record
  where role_record.is_active
    and (role_record.code = any(requested_codes) or role_record.code = 'customer')
  on conflict do nothing;

  insert into public.audit_logs (
    actor_profile_id, action, entity_type, entity_id, new_values
  ) values (
    auth.uid(), 'set_roles', 'profiles', _profile_id,
    jsonb_build_object('roles', to_jsonb(requested_codes))
  );
end;
$$;

/* -------------------------------------------------------------------------- */
/* Public settings validation and safe audit.                                 */
/* -------------------------------------------------------------------------- */

create or replace function public.validate_business_setting()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  allowed_keys constant text[] := array[
    'storeName', 'tagline', 'description', 'logoUrl', 'currency', 'locale',
    'taxIncluded', 'supportEmail', 'supportPhone', 'supportWhatsappEnabled',
    'supportWhatsappNumber', 'addressLine1', 'addressLine2', 'city', 'state',
    'postalCode', 'countryCode', 'freeShippingThreshold',
    'standardShippingFee', 'deliveryEstimate', 'returnsWindowDays',
    'announcementEnabled', 'announcementText', 'heroTitle', 'heroSubtitle',
    'instagramUrl', 'facebookUrl', 'storeHours', 'onlineOrdersEnabled',
    'codEnabled', 'codMin', 'codMax', 'codFee', 'storeVisitDiscount',
    'storeVisitValidityDays', 'storeVisitTerms'
  ];
  setting_key_name text;
begin
  if new.is_public and new.setting_value::text ~* '"[^\"]*(secret|token|password|credential|private.?key|service.?role|api.?key)[^\"]*"[[:space:]]*:' then
    raise exception using errcode = '22023', message = 'Public settings cannot contain credential-like keys';
  end if;

  if new.setting_key = 'store.settings' then
    if jsonb_typeof(new.setting_value) <> 'object' then
      raise exception using errcode = '22023', message = 'store.settings must be a JSON object';
    end if;
    for setting_key_name in select jsonb_object_keys(new.setting_value)
    loop
      if not (setting_key_name = any(allowed_keys)) then
        raise exception using errcode = '22023', message = 'Unsupported public store setting';
      end if;
    end loop;

    if coalesce(new.setting_value->>'currency', 'INR') <> 'INR' then
      raise exception using errcode = '22023', message = 'The checkout currency must be INR';
    end if;
    if new.setting_value ? 'onlineOrdersEnabled'
       and jsonb_typeof(new.setting_value->'onlineOrdersEnabled') <> 'boolean' then
      raise exception using errcode = '22023', message = 'onlineOrdersEnabled must be boolean';
    end if;
    if new.setting_value ? 'codEnabled'
       and jsonb_typeof(new.setting_value->'codEnabled') <> 'boolean' then
      raise exception using errcode = '22023', message = 'codEnabled must be boolean';
    end if;
    if new.setting_value ? 'taxIncluded'
       and jsonb_typeof(new.setting_value->'taxIncluded') <> 'boolean' then
      raise exception using errcode = '22023', message = 'taxIncluded must be boolean';
    end if;
    if exists (
      select 1
      from unnest(array[
        'freeShippingThreshold', 'standardShippingFee', 'codMin', 'codMax',
        'codFee', 'storeVisitDiscount', 'storeVisitValidityDays', 'returnsWindowDays'
      ]) numeric_key
      where new.setting_value ? numeric_key
        and new.setting_value->numeric_key <> 'null'::jsonb
        and jsonb_typeof(new.setting_value->numeric_key) <> 'number'
    ) then
      raise exception using errcode = '22023', message = 'Numeric store settings must be JSON numbers';
    end if;
    if coalesce((new.setting_value->>'standardShippingFee')::numeric, 0) < 0
       or coalesce((new.setting_value->>'codMin')::numeric, 0) < 0
       or coalesce((new.setting_value->>'codMax')::numeric, 0) < 0
       or coalesce((new.setting_value->>'codFee')::numeric, 0) < 0
       or coalesce((new.setting_value->>'storeVisitDiscount')::numeric, 0) < 0
       or coalesce((new.setting_value->>'storeVisitDiscount')::numeric, 0) > 100
       or coalesce((new.setting_value->>'storeVisitValidityDays')::numeric, 1) < 1 then
      raise exception using errcode = '22023', message = 'Store setting is outside its allowed range';
    end if;
    new.is_public := true;
  end if;
  return new;
end;
$$;

create or replace function public.audit_business_setting_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_safe jsonb;
  new_safe jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_safe := jsonb_build_object(
      'settingKey', old.setting_key,
      'isPublic', old.is_public,
      'settingValue', case when old.is_public then old.setting_value else '"[redacted]"'::jsonb end
    );
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_safe := jsonb_build_object(
      'settingKey', new.setting_key,
      'isPublic', new.is_public,
      'settingValue', case when new.is_public then new.setting_value else '"[redacted]"'::jsonb end
    );
  end if;
  insert into public.audit_logs (
    actor_profile_id, action, entity_type, old_values, new_values
  ) values (auth.uid(), lower(tg_op), 'business_settings', old_safe, new_safe);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists business_settings_validate on public.business_settings;
create trigger business_settings_validate
before insert or update on public.business_settings
for each row execute function public.validate_business_setting();

drop trigger if exists business_settings_audit on public.business_settings;
create trigger business_settings_audit
after insert or update or delete on public.business_settings
for each row execute function public.audit_business_setting_change();

insert into public.business_settings (
  setting_key, setting_value, description, is_public
)
values (
  'store.settings',
  jsonb_build_object(
    'storeName', 'Rider Shoes',
    'tagline', '',
    'description', '',
    'logoUrl', '',
    'currency', 'INR',
    'locale', 'en-IN',
    'taxIncluded', true,
    'supportEmail', '',
    'supportPhone', '',
    'supportWhatsappEnabled', false,
    'supportWhatsappNumber', '',
    'addressLine1', '',
    'addressLine2', '',
    'city', '',
    'state', '',
    'postalCode', '',
    'countryCode', 'IN',
    'freeShippingThreshold', null,
    'standardShippingFee', 0,
    'deliveryEstimate', '',
    'returnsWindowDays', 7,
    'announcementEnabled', false,
    'announcementText', '',
    'heroTitle', '',
    'heroSubtitle', '',
    'instagramUrl', '',
    'facebookUrl', '',
    'storeHours', '',
    'onlineOrdersEnabled', false,
    'codEnabled', false,
    'codMin', 0,
    'codMax', 0,
    'codFee', 0,
    'storeVisitDiscount', 0,
    'storeVisitValidityDays', 7,
    'storeVisitTerms', ''
  ),
  'Public storefront and checkout configuration. Never store credentials here.',
  true
)
on conflict (setting_key) do nothing;

/* -------------------------------------------------------------------------- */
/* Fail-closed delivery lookup.                                                */
/* -------------------------------------------------------------------------- */

create or replace function public.check_delivery(
  _postal_code text,
  _city text default '',
  _state text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  store_settings jsonb;
  area_record public.delivery_areas%rowtype;
  threshold numeric(12,2);
begin
  if _postal_code is null or trim(_postal_code) !~ '^[0-9]{6}$'
     or char_length(trim(coalesce(_city, ''))) > 100
     or char_length(trim(coalesce(_state, ''))) > 100 then
    return jsonb_build_object(
      'serviceable', false,
      'shipping_fee', 0,
      'free_shipping_threshold', null,
      'estimated_days_min', 0,
      'estimated_days_max', 0
    );
  end if;

  select setting_value into store_settings
  from public.business_settings
  where setting_key = 'store.settings' and is_public;

  if store_settings is null
     or coalesce(store_settings->>'onlineOrdersEnabled', 'false') <> 'true' then
    return jsonb_build_object(
      'serviceable', false,
      'shipping_fee', 0,
      'free_shipping_threshold', null,
      'estimated_days_min', 0,
      'estimated_days_max', 0
    );
  end if;

  select delivery_area.* into area_record
  from public.delivery_areas delivery_area
  where delivery_area.is_active
    and delivery_area.country_code = 'IN'
    and (delivery_area.postal_code is null or delivery_area.postal_code = trim(_postal_code))
    and (delivery_area.city is null or lower(trim(delivery_area.city)) = lower(trim(coalesce(_city, ''))))
    and (delivery_area.state is null or lower(trim(delivery_area.state)) = lower(trim(coalesce(_state, ''))))
  order by
    (delivery_area.postal_code is not null) desc,
    (delivery_area.city is not null) desc,
    (delivery_area.state is not null) desc,
    delivery_area.updated_at desc
  limit 1;

  if area_record.id is null then
    return jsonb_build_object(
      'serviceable', false,
      'shipping_fee', 0,
      'free_shipping_threshold', null,
      'estimated_days_min', 0,
      'estimated_days_max', 0
    );
  end if;

  threshold := area_record.free_shipping_threshold;
  if threshold is null
     and jsonb_typeof(store_settings->'freeShippingThreshold') = 'number' then
    threshold := (store_settings->>'freeShippingThreshold')::numeric(12,2);
  end if;

  return jsonb_build_object(
    'serviceable', true,
    'shipping_fee', area_record.shipping_fee,
    'free_shipping_threshold', threshold,
    'estimated_days_min', area_record.estimated_days_min,
    'estimated_days_max', area_record.estimated_days_max
  );
end;
$$;

/* -------------------------------------------------------------------------- */
/* Internal inventory, coupon, and durable event helpers.                     */
/* -------------------------------------------------------------------------- */

create or replace function public._enqueue_order_event(
  _order_id uuid,
  _event_type text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  order_record public.orders%rowtype;
begin
  if _event_type not in (
    'order.created', 'order.confirmed', 'order.packed',
    'order.out_for_delivery', 'order.delivered', 'order.cancelled',
    'order.refund_requested', 'payment.captured',
    'payment.captured_after_cancellation', 'payment.refunded'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported order event';
  end if;
  select * into order_record from public.orders where id = _order_id;
  if order_record.id is null or order_record.profile_id is null then
    return;
  end if;
  if coalesce((order_record.metadata->>'whatsappOptIn')::boolean, false) then
    insert into public.order_event_notifications (order_id, profile_id, event_type)
    values (order_record.id, order_record.profile_id, _event_type)
    on conflict (order_id, event_type) do nothing;
  end if;
end;
$$;

create or replace function public._commit_order_inventory(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allocation_record record;
  inventory_record public.inventory%rowtype;
begin
  for allocation_record in
    select allocation.order_id, allocation.variant_id, allocation.quantity
    from public.order_inventory_allocations allocation
    where allocation.order_id = _order_id and allocation.state = 'reserved'
    order by allocation.variant_id
    for update
  loop
    select * into inventory_record
    from public.inventory
    where variant_id = allocation_record.variant_id
    for update;
    if inventory_record.variant_id is null
       or inventory_record.reserved_quantity < allocation_record.quantity
       or inventory_record.quantity_on_hand < allocation_record.quantity then
      raise exception using errcode = '23514', message = 'Reserved inventory is inconsistent';
    end if;
    update public.inventory
    set quantity_on_hand = quantity_on_hand - allocation_record.quantity,
        reserved_quantity = reserved_quantity - allocation_record.quantity
    where variant_id = allocation_record.variant_id;
    insert into public.inventory_movements (
      variant_id, quantity_delta, reason, reference_type, reference_id, note
    ) values (
      allocation_record.variant_id, -allocation_record.quantity, 'sale',
      'order', _order_id, 'Razorpay payment captured; reservation committed'
    );
    update public.order_inventory_allocations
    set state = 'committed'
    where order_id = _order_id and variant_id = allocation_record.variant_id;
  end loop;
end;
$$;

create or replace function public._release_order_inventory(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allocation_record record;
  inventory_record public.inventory%rowtype;
begin
  for allocation_record in
    select allocation.order_id, allocation.variant_id, allocation.quantity, allocation.state
    from public.order_inventory_allocations allocation
    where allocation.order_id = _order_id
      and allocation.state in ('reserved', 'committed')
    order by allocation.variant_id
    for update
  loop
    select * into inventory_record
    from public.inventory
    where variant_id = allocation_record.variant_id
    for update;
    if inventory_record.variant_id is null then
      raise exception using errcode = '23514', message = 'Order inventory record is missing';
    end if;
    if allocation_record.state = 'reserved' then
      if inventory_record.reserved_quantity < allocation_record.quantity then
        raise exception using errcode = '23514', message = 'Reserved inventory is inconsistent';
      end if;
      update public.inventory
      set reserved_quantity = reserved_quantity - allocation_record.quantity
      where variant_id = allocation_record.variant_id;
      insert into public.inventory_movements (
        variant_id, quantity_delta, reason, reference_type, reference_id, note
      ) values (
        allocation_record.variant_id, allocation_record.quantity, 'release',
        'order', _order_id, 'Unpaid order reservation released'
      );
      update public.order_inventory_allocations set state = 'released'
      where order_id = _order_id and variant_id = allocation_record.variant_id;
    else
      update public.inventory
      set quantity_on_hand = quantity_on_hand + allocation_record.quantity
      where variant_id = allocation_record.variant_id;
      insert into public.inventory_movements (
        variant_id, quantity_delta, reason, reference_type, reference_id, note
      ) values (
        allocation_record.variant_id, allocation_record.quantity, 'return',
        'order', _order_id, 'Cancelled committed order restored to stock'
      );
      update public.order_inventory_allocations set state = 'restored'
      where order_id = _order_id and variant_id = allocation_record.variant_id;
    end if;
  end loop;
end;
$$;

create or replace function public._release_order_coupon(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  redemption_record public.coupon_redemptions%rowtype;
begin
  select * into redemption_record
  from public.coupon_redemptions
  where order_id = _order_id
  for update;
  if redemption_record.id is not null and redemption_record.status <> 'released' then
    update public.coupons
    set usage_count = greatest(usage_count - 1, 0)
    where id = redemption_record.coupon_id;
    update public.coupon_redemptions
    set status = 'released', released_at = now()
    where id = redemption_record.id;
  end if;
end;
$$;
