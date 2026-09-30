-- Rider Shoes ecommerce backend foundation.
--
-- This migration intentionally keeps authorization data separate from profiles.
-- A client can edit profile data, but cannot assign itself a role: role membership
-- is held in profile_roles and all role checks go through SECURITY DEFINER helpers.

begin;

create extension if not exists pgcrypto;

/* -------------------------------------------------------------------------- */
/* Helper functions that are referenced by defaults, policies, and triggers.  */
/* -------------------------------------------------------------------------- */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_order_number()
returns text
language sql
volatile
as $$
  select 'RS-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

/* -------------------------------------------------------------------------- */
/* Identity, roles, and permissions.                                          */
/* -------------------------------------------------------------------------- */

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z][a-z0-9_.-]*$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z][a-z0-9_.-]*$'),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create or replace function public.has_role(_role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = auth.uid()
      and r.code = lower(_role_code)
      and r.is_active
  );
$$;

create or replace function public.has_permission(_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = auth.uid()
      and r.is_active
      and p.code = lower(_permission_code)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('owner')
      or public.has_role('admin')
      or public.has_role('staff')
      or public.has_role('support')
      or public.has_role('fulfillment');
$$;

/* -------------------------------------------------------------------------- */
/* Business and catalog.                                                       */
/* -------------------------------------------------------------------------- */

create table public.business_settings (
  setting_key text primary key check (length(setting_key) between 1 and 120),
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name text not null,
  description text,
  image_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_slug_not_blank check (length(trim(slug)) > 0),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  logo_url text,
  website_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_name_not_blank check (length(trim(name)) > 0),
  constraint brands_slug_not_blank check (length(trim(slug)) > 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  slug text not null,
  name text not null,
  short_description text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_slug_not_blank check (length(trim(slug)) > 0)
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_path_not_blank check (length(trim(storage_path)) > 0)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  size text,
  color text,
  option_values jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_sku_not_blank check (length(trim(sku)) > 0)
);

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_not_over_on_hand check (reserved_quantity <= quantity_on_hand)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('purchase', 'sale', 'return', 'adjustment', 'reservation', 'release', 'damage')),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* Customer state, promotions, and delivery.                                  */
/* -------------------------------------------------------------------------- */

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_required_text check (
    length(trim(recipient_name)) > 0 and length(trim(address_line_1)) > 0 and
    length(trim(city)) > 0 and length(trim(state)) > 0 and length(trim(postal_code)) > 0
  )
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  session_key_hash text unique,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_have_owner check (profile_id is not null or session_key_hash is not null)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Favorites',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishlists_name_not_blank check (length(trim(name)) > 0)
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed', 'free_shipping')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  maximum_discount_amount numeric(12,2) check (maximum_discount_amount is null or maximum_discount_amount >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_lower check (code = upper(code) and length(trim(code)) between 2 and 40),
  constraint coupons_percent_range check (discount_type <> 'percent' or discount_value <= 100),
  constraint coupons_date_range check (expires_at is null or starts_at is null or expires_at >= starts_at)
);

create table public.coupon_products (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (coupon_id, product_id)
);

create table public.coupon_categories (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (coupon_id, category_id)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  offer_type text not null check (offer_type in ('percent', 'fixed', 'buy_x_get_y', 'free_shipping')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  is_stackable boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_name_not_blank check (length(trim(name)) > 0),
  constraint offers_percent_range check (offer_type <> 'percent' or discount_value <= 100),
  constraint offers_date_range check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.offer_products (
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (offer_id, product_id)
);

create table public.offer_categories (
  offer_id uuid not null references public.offers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (offer_id, category_id)
);

create table public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  state text,
  city text,
  postal_code text,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold numeric(12,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  estimated_days_min integer not null default 1 check (estimated_days_min > 0),
  estimated_days_max integer not null default 7 check (estimated_days_max >= estimated_days_min),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_areas_name_not_blank check (length(trim(name)) > 0)
);

/* -------------------------------------------------------------------------- */
/* Checkout, orders, payments, and fulfillment.                               */
/* -------------------------------------------------------------------------- */

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  profile_id uuid references public.profiles(id) on delete set null,
  cart_id uuid references public.carts(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned')),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  total_amount numeric(12,2) generated always as (greatest(0::numeric, subtotal - discount_total + tax_total + shipping_total)) stored,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(12,2) not null default 0 check (amount_refunded >= 0),
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  customer_note text,
  internal_note text,
  metadata jsonb not null default '{}'::jsonb,
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_profile_or_guest_cart check (profile_id is not null or cart_id is not null),
  constraint orders_refund_not_over_paid check (amount_refunded <= amount_paid),
  constraint orders_addresses_objects check (jsonb_typeof(shipping_address) = 'object' and jsonb_typeof(billing_address) = 'object')
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  sku text,
  size text,
  color text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(12,2) generated always as (greatest(0::numeric, quantity * unit_price - discount_amount + tax_amount)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_product_name_not_blank check (length(trim(product_name)) > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'cod', 'other')),
  provider_order_id text,
  provider_payment_id text,
  amount numeric(12,2) not null check (amount >= 0),
  provider_amount bigint check (provider_amount is null or provider_amount >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  method text,
  signature_verified boolean not null default false,
  failure_code text,
  failure_message text,
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  redeemed_at timestamptz not null default now()
);

/* -------------------------------------------------------------------------- */
/* Messaging, analytics, and operational audit.                               */
/* -------------------------------------------------------------------------- */

create table public.store_visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  session_id_hash text,
  path text not null,
  referrer text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint store_visits_path_not_blank check (length(trim(path)) > 0)
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider_template_name text not null,
  language_code text not null default 'en_US',
  category text not null default 'UTILITY' check (category in ('AUTHENTICATION', 'MARKETING', 'UTILITY')),
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_templates_name_not_blank check (length(trim(name)) > 0),
  constraint whatsapp_templates_provider_name_not_blank check (length(trim(provider_template_name)) > 0),
  constraint whatsapp_templates_variables_array check (jsonb_typeof(variables) = 'array')
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  notification_type text not null,
  title text not null,
  body text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  data jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_title_not_blank check (length(trim(title)) > 0)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  request_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

/* Ownership helpers are defined after their target tables so migration-time
   function validation succeeds with check_function_bodies enabled. */
create or replace function public.owns_cart(_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.carts c
    where c.id = _cart_id and c.profile_id = auth.uid()
  );
$$;

create or replace function public.owns_wishlist(_wishlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wishlists w
    where w.id = _wishlist_id and w.profile_id = auth.uid()
  );
$$;

create or replace function public.owns_order(_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = _order_id and o.profile_id = auth.uid()
  );
$$;

/* -------------------------------------------------------------------------- */
/* Indexes.                                                                   */
/* -------------------------------------------------------------------------- */

create unique index categories_slug_lower_idx on public.categories (lower(slug));
create unique index brands_slug_lower_idx on public.brands (lower(slug));
create unique index products_slug_lower_idx on public.products (lower(slug));
create unique index product_variants_sku_lower_idx on public.product_variants (lower(sku));
create unique index coupons_code_upper_idx on public.coupons (upper(code));
create unique index whatsapp_templates_provider_name_language_idx
  on public.whatsapp_templates (provider_template_name, language_code);

create unique index product_images_one_primary_idx
  on public.product_images (product_id) where is_primary;
create unique index product_categories_one_primary_idx
  on public.product_categories (product_id) where is_primary;
create unique index wishlists_one_default_idx
  on public.wishlists (profile_id) where is_default;
create unique index carts_one_active_per_profile_idx
  on public.carts (profile_id) where profile_id is not null and status = 'active';
create unique index carts_one_active_guest_idx
  on public.carts (session_key_hash) where session_key_hash is not null and status = 'active';
create unique index payments_provider_order_idx
  on public.payments (provider, provider_order_id) where provider_order_id is not null;
create unique index payments_provider_payment_idx
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;

create unique index profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;
create index profile_roles_role_idx on public.profile_roles (role_id);
create index categories_parent_active_idx on public.categories (parent_id, is_active, sort_order);
create index brands_active_sort_idx on public.brands (is_active, sort_order);
create index products_brand_status_idx on public.products (brand_id, status);
create index products_status_created_idx on public.products (status, created_at desc);
create index products_search_idx on public.products using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(description, ''))
);
create index product_categories_category_idx on public.product_categories (category_id, product_id);
create index product_images_product_sort_idx on public.product_images (product_id, sort_order);
create unique index product_images_product_path_idx on public.product_images (product_id, storage_path);
create index product_variants_product_active_idx on public.product_variants (product_id, is_active);
create index inventory_movements_variant_created_idx on public.inventory_movements (variant_id, created_at desc);
create index customer_addresses_profile_idx on public.customer_addresses (profile_id, created_at desc);
create unique index customer_addresses_one_default_shipping_idx
  on public.customer_addresses (profile_id) where is_default_shipping;
create unique index customer_addresses_one_default_billing_idx
  on public.customer_addresses (profile_id) where is_default_billing;
create index cart_items_variant_idx on public.cart_items (variant_id);
create index wishlists_profile_idx on public.wishlists (profile_id);
create index wishlist_items_product_idx on public.wishlist_items (product_id);
create index coupons_active_dates_idx on public.coupons (is_active, starts_at, expires_at);
create index coupon_products_product_idx on public.coupon_products (product_id);
create index coupon_categories_category_idx on public.coupon_categories (category_id);
create index offers_active_dates_idx on public.offers (is_active, starts_at, ends_at, priority desc);
create index offer_products_product_idx on public.offer_products (product_id);
create index offer_categories_category_idx on public.offer_categories (category_id);
create index delivery_areas_lookup_idx on public.delivery_areas (country_code, postal_code, is_active);
create index orders_profile_created_idx on public.orders (profile_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index payments_order_created_idx on public.payments (order_id, created_at desc);
create index coupon_redemptions_coupon_profile_idx on public.coupon_redemptions (coupon_id, profile_id);
create index store_visits_profile_occurred_idx on public.store_visits (profile_id, occurred_at desc);
create index store_visits_occurred_idx on public.store_visits (occurred_at desc);
create index notifications_profile_status_idx on public.notifications (profile_id, status, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_profile_id, created_at desc);

/* -------------------------------------------------------------------------- */
/* Validation and lifecycle triggers.                                         */
/* -------------------------------------------------------------------------- */

create or replace function public.validate_category_parent()
returns trigger
language plpgsql
as $$
declare
  cycle_found boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent';
  end if;

  with recursive ancestors(id, path) as (
    select c.parent_id, array[c.id, c.parent_id]
    from public.categories c
    where c.id = new.parent_id
    union all
    select c.parent_id, a.path || c.parent_id
    from public.categories c
    join ancestors a on c.id = a.id
    where c.parent_id is not null and not c.parent_id = any(a.path)
  )
  select exists(select 1 from ancestors where id = new.id) into cycle_found;

  if cycle_found then
    raise exception 'Category hierarchy cycle detected';
  end if;

  return new;
end;
$$;

create or replace function public.validate_inventory_quantities()
returns trigger
language plpgsql
as $$
begin
  if new.quantity_on_hand < 0 or new.reserved_quantity < 0 then
    raise exception 'Inventory quantities cannot be negative';
  end if;
  if new.reserved_quantity > new.quantity_on_hand then
    raise exception 'Reserved inventory cannot exceed quantity on hand';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_role_id uuid;
  display_name_value text;
begin
  display_name_value := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );

  insert into public.profiles (id, email, full_name, phone, metadata)
  values (
    new.id,
    new.email,
    nullif(display_name_value, ''),
    nullif(new.phone, ''),
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();

  select id into customer_role_id from public.roles where code = 'customer' and is_active;
  if customer_role_id is not null then
    insert into public.profile_roles (profile_id, role_id)
    values (new.id, customer_role_id)
    on conflict (profile_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.has_permission('profiles.manage') then
    if new.id <> old.id or new.email is distinct from old.email or
       new.is_active is distinct from old.is_active then
      raise exception 'Profile identity and account-state fields are managed by trusted services';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_role_assignments()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.has_permission('roles.manage') then
    raise exception 'Role assignments can only be changed by an authorized administrator';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.protect_cart_state()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.has_permission('orders.manage') then
    if tg_op = 'INSERT' then
      if new.profile_id is distinct from auth.uid() or new.status <> 'active' then
        raise exception 'Clients may only create their own active cart';
      end if;
    elsif new.profile_id is distinct from old.profile_id then
      raise exception 'Cart ownership cannot be changed by a client';
    elsif new.status not in ('active', 'abandoned') then
      raise exception 'Clients cannot convert a cart directly';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_notification_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.has_permission('notifications.send') then
    if new.profile_id is distinct from old.profile_id or
       new.channel is distinct from old.channel or
       new.notification_type is distinct from old.notification_type or
       new.title is distinct from old.title or
       new.body is distinct from old.body or
       new.data is distinct from old.data or
       new.error_message is distinct from old.error_message or
       new.sent_at is distinct from old.sent_at or
       new.created_at is distinct from old.created_at then
      raise exception 'Clients may only mark their own notification as read';
    end if;
    if new.status not in (old.status, 'read') then
      raise exception 'Invalid client notification status transition';
    end if;
    if new.read_at is distinct from old.read_at and new.status <> 'read' then
      raise exception 'read_at can only be changed when marking a notification as read';
    end if;
    if new.status = 'read' and new.read_at is null then
      new.read_at = now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  /* Join tables do not have an id column; their audit row can still retain
     the full old/new JSON while using a null entity_id. */
  if tg_op = 'DELETE' then
    row_id := nullif(to_jsonb(old)->>'id', '')::uuid;
  else
    row_id := nullif(to_jsonb(new)->>'id', '')::uuid;
  end if;
  insert into public.audit_logs (
    actor_profile_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at before update on public.permissions
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger business_settings_set_updated_at before update on public.business_settings
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger categories_validate_parent before insert or update of parent_id on public.categories
for each row execute function public.validate_category_parent();
create trigger brands_set_updated_at before update on public.brands
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_images_set_updated_at before update on public.product_images
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger inventory_validate before insert or update on public.inventory
for each row execute function public.validate_inventory_quantities();
create trigger customer_addresses_set_updated_at before update on public.customer_addresses
for each row execute function public.set_updated_at();
create trigger carts_set_updated_at before update on public.carts
for each row execute function public.set_updated_at();
create trigger carts_protect_state before insert or update on public.carts
for each row execute function public.protect_cart_state();
create trigger cart_items_set_updated_at before update on public.cart_items
for each row execute function public.set_updated_at();
create trigger wishlists_set_updated_at before update on public.wishlists
for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at before update on public.coupons
for each row execute function public.set_updated_at();
create trigger offers_set_updated_at before update on public.offers
for each row execute function public.set_updated_at();
create trigger delivery_areas_set_updated_at before update on public.delivery_areas
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger order_items_set_updated_at before update on public.order_items
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates
for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();
create trigger notifications_protect_update before update on public.notifications
for each row execute function public.protect_notification_update();

create trigger profile_roles_protect before insert or update or delete on public.profile_roles
for each row execute function public.protect_role_assignments();
create trigger role_permissions_protect before insert or update or delete on public.role_permissions
for each row execute function public.protect_role_assignments();
create trigger profiles_protect_identity before update on public.profiles
for each row execute function public.protect_profile_identity();

create trigger categories_audit after insert or update or delete on public.categories
for each row execute function public.audit_row_change();
create trigger brands_audit after insert or update or delete on public.brands
for each row execute function public.audit_row_change();
create trigger products_audit after insert or update or delete on public.products
for each row execute function public.audit_row_change();
create trigger product_variants_audit after insert or update or delete on public.product_variants
for each row execute function public.audit_row_change();
create trigger coupons_audit after insert or update or delete on public.coupons
for each row execute function public.audit_row_change();
create trigger offers_audit after insert or update or delete on public.offers
for each row execute function public.audit_row_change();
create trigger orders_audit after insert or update or delete on public.orders
for each row execute function public.audit_row_change();
create trigger profile_roles_audit after insert or update or delete on public.profile_roles
for each row execute function public.audit_row_change();

/* The auth trigger is installed after the customer role seed below. */

/* -------------------------------------------------------------------------- */
/* Baseline roles, permissions, and public settings.                          */
/* -------------------------------------------------------------------------- */

insert into public.roles (code, name, description)
values
  ('customer', 'Customer', 'Can manage their own shopping data'),
  ('staff', 'Staff', 'Can manage catalog and day-to-day operations'),
  ('support', 'Support', 'Can assist customers and view orders'),
  ('fulfillment', 'Fulfillment', 'Can process inventory and shipments'),
  ('admin', 'Administrator', 'Can manage the store and its operators'),
  ('owner', 'Owner', 'Full store administration')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.permissions (code, name, description)
values
  ('catalog.manage', 'Manage catalog', 'Create and update categories, brands, products, and variants'),
  ('inventory.manage', 'Manage inventory', 'Adjust stock and inventory movements'),
  ('orders.read_all', 'Read all orders', 'View customer orders across the store'),
  ('orders.manage', 'Manage orders', 'Update order state, fulfillment, and carts'),
  ('payments.manage', 'Manage payments', 'View and reconcile payment records'),
  ('discounts.manage', 'Manage discounts', 'Manage coupons and promotional offers'),
  ('delivery.manage', 'Manage delivery', 'Manage delivery areas and fees'),
  ('settings.manage', 'Manage settings', 'Manage business settings'),
  ('profiles.read_all', 'Read all profiles', 'View customer profiles for support'),
  ('profiles.manage', 'Manage profiles', 'Manage profile identity and account state'),
  ('roles.manage', 'Manage roles', 'Assign roles and permissions'),
  ('notifications.send', 'Send notifications', 'Send WhatsApp and other customer notifications'),
  ('audit.read', 'Read audit logs', 'View operational audit records'),
  ('analytics.read', 'Read analytics', 'View store visit and business analytics')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'catalog.manage', 'inventory.manage', 'orders.read_all', 'orders.manage',
  'payments.manage', 'discounts.manage', 'delivery.manage', 'settings.manage',
  'profiles.read_all', 'notifications.send', 'audit.read', 'analytics.read'
)
where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('orders.read_all', 'profiles.read_all', 'notifications.send')
where r.code = 'support'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('inventory.manage', 'orders.read_all', 'orders.manage', 'delivery.manage')
where r.code = 'fulfillment'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('catalog.manage', 'inventory.manage', 'orders.read_all', 'orders.manage', 'notifications.send')
where r.code = 'staff'
on conflict do nothing;

insert into public.business_settings (setting_key, setting_value, description, is_public)
values
  ('store.name', '"Rider Shoes"'::jsonb, 'Display name for the storefront', true),
  ('store.currency', '"INR"'::jsonb, 'Default store currency', true),
  ('store.tax_included', 'true'::jsonb, 'Whether displayed prices include tax', true),
  ('store.support_whatsapp_enabled', 'false'::jsonb, 'Whether WhatsApp support is enabled', true)
on conflict (setting_key) do nothing;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_user();

/* -------------------------------------------------------------------------- */
/* Row-level security.                                                        */
/* -------------------------------------------------------------------------- */

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profile_roles enable row level security;
alter table public.business_settings enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_products enable row level security;
alter table public.coupon_categories enable row level security;
alter table public.offers enable row level security;
alter table public.offer_products enable row level security;
alter table public.offer_categories enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.store_visits enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payment_webhook_events enable row level security;

/* Identity and authorization data. */
create policy roles_read_authenticated on public.roles
for select to authenticated using (true);
create policy roles_manage on public.roles
for all to authenticated using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy permissions_read_authenticated on public.permissions
for select to authenticated using (true);
create policy permissions_manage on public.permissions
for all to authenticated using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy profiles_read_own_or_support on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_permission('profiles.read_all'));
create policy profiles_update_own_or_manager on public.profiles
for update to authenticated
using (id = auth.uid() or public.has_permission('profiles.manage'))
with check (id = auth.uid() or public.has_permission('profiles.manage'));

create policy role_permissions_read_staff on public.role_permissions
for select to authenticated using (public.has_permission('roles.manage'));
create policy role_permissions_manage on public.role_permissions
for all to authenticated using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy profile_roles_read_self_or_admin on public.profile_roles
for select to authenticated
using (profile_id = auth.uid() or public.has_permission('roles.manage'));
create policy profile_roles_manage on public.profile_roles
for all to authenticated using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

/* Public catalog and storefront configuration. */
create policy business_settings_read_public on public.business_settings
for select to anon, authenticated using (is_public);
create policy business_settings_manage on public.business_settings
for all to authenticated using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage'));

create policy categories_read_active on public.categories
for select to anon, authenticated using (is_active);
create policy categories_manage on public.categories
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy brands_read_active on public.brands
for select to anon, authenticated using (is_active);
create policy brands_manage on public.brands
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy products_read_active on public.products
for select to anon, authenticated using (status = 'active');
create policy products_manage on public.products
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy product_categories_read_active on public.product_categories
for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
);
create policy product_categories_manage on public.product_categories
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy product_images_read_active on public.product_images
for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy product_images_manage on public.product_images
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy product_variants_read_active on public.product_variants
for select to anon, authenticated using (
  is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy product_variants_manage on public.product_variants
for all to authenticated using (public.has_permission('catalog.manage'))
with check (public.has_permission('catalog.manage'));

create policy inventory_read_staff on public.inventory
for select to authenticated using (public.has_permission('inventory.manage'));
create policy inventory_manage on public.inventory
for all to authenticated using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));
create policy inventory_movements_read_staff on public.inventory_movements
for select to authenticated using (public.has_permission('inventory.manage'));
create policy inventory_movements_manage on public.inventory_movements
for all to authenticated using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));

/* Customer-owned shopping state. */
create policy customer_addresses_read_own on public.customer_addresses
for select to authenticated using (profile_id = auth.uid());
create policy customer_addresses_insert_own on public.customer_addresses
for insert to authenticated with check (profile_id = auth.uid());
create policy customer_addresses_update_own on public.customer_addresses
for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy customer_addresses_delete_own on public.customer_addresses
for delete to authenticated using (profile_id = auth.uid());
create policy customer_addresses_support on public.customer_addresses
for select to authenticated using (public.has_permission('profiles.read_all'));

create policy carts_read_own_or_staff on public.carts
for select to authenticated using (profile_id = auth.uid() or public.has_permission('orders.manage'));
create policy carts_insert_own on public.carts
for insert to authenticated with check (profile_id = auth.uid());
create policy carts_update_own_or_staff on public.carts
for update to authenticated
using (profile_id = auth.uid() or public.has_permission('orders.manage'))
with check (profile_id = auth.uid() or public.has_permission('orders.manage'));
create policy carts_delete_own_or_staff on public.carts
for delete to authenticated using (profile_id = auth.uid() or public.has_permission('orders.manage'));

create policy cart_items_read_own_or_staff on public.cart_items
for select to authenticated using (public.owns_cart(cart_id) or public.has_permission('orders.manage'));
create policy cart_items_insert_own_or_staff on public.cart_items
for insert to authenticated with check (public.owns_cart(cart_id) or public.has_permission('orders.manage'));
create policy cart_items_update_own_or_staff on public.cart_items
for update to authenticated
using (public.owns_cart(cart_id) or public.has_permission('orders.manage'))
with check (public.owns_cart(cart_id) or public.has_permission('orders.manage'));
create policy cart_items_delete_own_or_staff on public.cart_items
for delete to authenticated using (public.owns_cart(cart_id) or public.has_permission('orders.manage'));

create policy wishlists_read_own on public.wishlists
for select to authenticated using (profile_id = auth.uid());
create policy wishlists_insert_own on public.wishlists
for insert to authenticated with check (profile_id = auth.uid());
create policy wishlists_update_own on public.wishlists
for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy wishlists_delete_own on public.wishlists
for delete to authenticated using (profile_id = auth.uid());

create policy wishlist_items_read_own on public.wishlist_items
for select to authenticated using (public.owns_wishlist(wishlist_id));
create policy wishlist_items_insert_own on public.wishlist_items
for insert to authenticated with check (public.owns_wishlist(wishlist_id));
create policy wishlist_items_delete_own on public.wishlist_items
for delete to authenticated using (public.owns_wishlist(wishlist_id));

/* Promotions and delivery lookup. */
create policy coupons_read_current on public.coupons
for select to anon, authenticated using (
  is_active and
  (starts_at is null or starts_at <= now()) and
  (expires_at is null or expires_at >= now()) and
  (usage_limit is null or usage_count < usage_limit)
);
create policy coupons_manage on public.coupons
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));
create policy coupon_products_read_current on public.coupon_products
for select to anon, authenticated using (
  exists (select 1 from public.coupons c where c.id = coupon_id and c.is_active)
);
create policy coupon_products_manage on public.coupon_products
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));
create policy coupon_categories_read_current on public.coupon_categories
for select to anon, authenticated using (
  exists (select 1 from public.coupons c where c.id = coupon_id and c.is_active)
);
create policy coupon_categories_manage on public.coupon_categories
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));

create policy offers_read_current on public.offers
for select to anon, authenticated using (
  is_active and
  (starts_at is null or starts_at <= now()) and
  (ends_at is null or ends_at >= now())
);
create policy offers_manage on public.offers
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));
create policy offer_products_read_current on public.offer_products
for select to anon, authenticated using (
  exists (select 1 from public.offers o where o.id = offer_id and o.is_active)
);
create policy offer_products_manage on public.offer_products
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));
create policy offer_categories_read_current on public.offer_categories
for select to anon, authenticated using (
  exists (select 1 from public.offers o where o.id = offer_id and o.is_active)
);
create policy offer_categories_manage on public.offer_categories
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));

create policy delivery_areas_read_active on public.delivery_areas
for select to anon, authenticated using (is_active);
create policy delivery_areas_manage on public.delivery_areas
for all to authenticated using (public.has_permission('delivery.manage'))
with check (public.has_permission('delivery.manage'));

/* Orders are created and mutated by trusted checkout/webhook code. */
create policy orders_read_own on public.orders
for select to authenticated using (profile_id = auth.uid());
create policy orders_read_staff on public.orders
for select to authenticated using (public.has_permission('orders.read_all'));
create policy orders_manage_staff on public.orders
for all to authenticated using (public.has_permission('orders.manage'))
with check (public.has_permission('orders.manage'));

create policy order_items_read_own on public.order_items
for select to authenticated using (public.owns_order(order_id));
create policy order_items_read_staff on public.order_items
for select to authenticated using (public.has_permission('orders.read_all'));
create policy order_items_manage_staff on public.order_items
for all to authenticated using (public.has_permission('orders.manage'))
with check (public.has_permission('orders.manage'));

create policy payments_read_staff on public.payments
for select to authenticated using (public.has_permission('payments.manage'));
create policy payments_manage_staff on public.payments
for all to authenticated using (public.has_permission('payments.manage'))
with check (public.has_permission('payments.manage'));

create policy coupon_redemptions_read_own on public.coupon_redemptions
for select to authenticated using (profile_id = auth.uid());
create policy coupon_redemptions_read_staff on public.coupon_redemptions
for select to authenticated using (public.has_permission('discounts.manage'));
create policy coupon_redemptions_manage_staff on public.coupon_redemptions
for all to authenticated using (public.has_permission('discounts.manage'))
with check (public.has_permission('discounts.manage'));

/* Visits accept only an anonymous visit or the caller's own profile id. */
create policy store_visits_insert_anon on public.store_visits
for insert to anon with check (profile_id is null);
create policy store_visits_insert_authenticated on public.store_visits
for insert to authenticated with check (profile_id is null or profile_id = auth.uid());
create policy store_visits_read_staff on public.store_visits
for select to authenticated using (public.has_permission('analytics.read'));

/* Messaging and audit records are never client-writable. */
create policy whatsapp_templates_read_staff on public.whatsapp_templates
for select to authenticated using (public.has_permission('notifications.send'));
create policy whatsapp_templates_manage on public.whatsapp_templates
for all to authenticated using (public.has_permission('notifications.send'))
with check (public.has_permission('notifications.send'));

create policy notifications_read_own on public.notifications
for select to authenticated using (profile_id = auth.uid());
create policy notifications_update_own_read_state on public.notifications
for update to authenticated using (profile_id = auth.uid())
with check (profile_id = auth.uid());
create policy notifications_read_staff on public.notifications
for select to authenticated using (public.has_permission('notifications.send'));
create policy notifications_manage_staff on public.notifications
for all to authenticated using (public.has_permission('notifications.send'))
with check (public.has_permission('notifications.send'));

create policy audit_logs_read on public.audit_logs
for select to authenticated using (public.has_permission('audit.read'));
create policy payment_webhook_events_read on public.payment_webhook_events
for select to authenticated using (public.has_permission('payments.manage'));

/* -------------------------------------------------------------------------- */
/* Grants: RLS is the authorization boundary; these grants only expose the   */
/* intended API surface to Supabase's anon/authenticated roles.               */
/* -------------------------------------------------------------------------- */

grant usage on schema public to anon, authenticated;

grant select on
  public.business_settings,
  public.categories,
  public.brands,
  public.products,
  public.product_categories,
  public.product_images,
  public.product_variants,
  public.coupons,
  public.coupon_products,
  public.coupon_categories,
  public.offers,
  public.offer_products,
  public.offer_categories,
  public.delivery_areas
to anon, authenticated;

grant select on
  public.roles,
  public.permissions,
  public.profiles,
  public.role_permissions,
  public.profile_roles,
  public.inventory,
  public.inventory_movements,
  public.customer_addresses,
  public.carts,
  public.cart_items,
  public.wishlists,
  public.wishlist_items,
  public.orders,
  public.order_items,
  public.payments,
  public.coupon_redemptions,
  public.store_visits,
  public.whatsapp_templates,
  public.notifications,
  public.audit_logs,
  public.payment_webhook_events
to authenticated;

grant insert, update, delete on
  public.customer_addresses,
  public.carts,
  public.cart_items,
  public.wishlists,
  public.wishlist_items,
  public.store_visits
to authenticated;

grant insert on public.store_visits to anon;

grant update on public.profiles, public.notifications to authenticated;

/* Staff DML is still fenced by the matching RLS policies above. */
grant insert, update, delete on
  public.roles,
  public.permissions,
  public.role_permissions,
  public.profile_roles,
  public.business_settings,
  public.categories,
  public.brands,
  public.products,
  public.product_categories,
  public.product_images,
  public.product_variants,
  public.inventory,
  public.inventory_movements,
  public.coupons,
  public.coupon_products,
  public.coupon_categories,
  public.offers,
  public.offer_products,
  public.offer_categories,
  public.delivery_areas,
  public.orders,
  public.order_items,
  public.payments,
  public.coupon_redemptions,
  public.whatsapp_templates,
  public.notifications
to authenticated;

revoke all on function public.has_role(text) from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.is_staff() from public;
revoke all on function public.owns_cart(uuid) from public;
revoke all on function public.owns_wishlist(uuid) from public;
revoke all on function public.owns_order(uuid) from public;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.owns_cart(uuid) to authenticated;
grant execute on function public.owns_wishlist(uuid) to authenticated;
grant execute on function public.owns_order(uuid) to authenticated;

/* -------------------------------------------------------------------------- */
/* Storage buckets and policies.                                               */
/* -------------------------------------------------------------------------- */

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('brand-assets', 'brand-assets', true),
  ('banners', 'banners', true),
  ('category-images', 'category-images', true)
on conflict (id) do update set public = excluded.public;

create policy product_images_bucket_read on storage.objects
for select to public using (bucket_id = 'product-images');
create policy product_images_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy product_images_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'product-images' and public.has_permission('catalog.manage'))
with check (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy product_images_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));

create policy brand_assets_bucket_read on storage.objects
for select to public using (bucket_id = 'brand-assets');
create policy brand_assets_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'brand-assets' and public.has_permission('catalog.manage'));
create policy brand_assets_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'brand-assets' and public.has_permission('catalog.manage'))
with check (bucket_id = 'brand-assets' and public.has_permission('catalog.manage'));
create policy brand_assets_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'brand-assets' and public.has_permission('catalog.manage'));

create policy banners_bucket_read on storage.objects
for select to public using (bucket_id = 'banners');
create policy banners_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'banners' and public.has_permission('catalog.manage'));
create policy banners_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'banners' and public.has_permission('catalog.manage'))
with check (bucket_id = 'banners' and public.has_permission('catalog.manage'));
create policy banners_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'banners' and public.has_permission('catalog.manage'));

create policy category_images_bucket_read on storage.objects
for select to public using (bucket_id = 'category-images');
create policy category_images_bucket_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'category-images' and public.has_permission('catalog.manage'));
create policy category_images_bucket_update on storage.objects
for update to authenticated
using (bucket_id = 'category-images' and public.has_permission('catalog.manage'))
with check (bucket_id = 'category-images' and public.has_permission('catalog.manage'));
create policy category_images_bucket_delete on storage.objects
for delete to authenticated
using (bucket_id = 'category-images' and public.has_permission('catalog.manage'));

commit;
