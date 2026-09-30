begin;

/* Production checkout: validates prices/inventory in the database, creates the
   order atomically, and reserves/commits stock under row locks. Supports both
   signed-in customers and guests through the cart_id created here. */
create or replace function public.create_checkout(
  _items jsonb,
  _details jsonb,
  _coupon text default null,
  _idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  variant_record public.product_variants%rowtype;
  product_record public.products%rowtype;
  inventory_record public.inventory%rowtype;
  order_id uuid;
  cart_id uuid;
  profile_id uuid := auth.uid();
  order_status text;
  payment_status text;
  payment_method text;
  subtotal numeric(12,2) := 0;
  shipping_total numeric(12,2) := 0;
  detail_name text;
  detail_email text;
  detail_phone text;
  postal_code text;
  city text;
  state_name text;
  address jsonb;
  delivery jsonb;
  quantity integer;
  item_price numeric(12,2);
  product_name text;
  product_slug text;
  existing_order uuid;
  guest_session text;
begin
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception using errcode = '22023', message = 'Cart is empty';
  end if;
  if jsonb_typeof(_details) <> 'object' then
    raise exception using errcode = '22023', message = 'Checkout details are invalid';
  end if;

  select id into existing_order
  from public.orders
  where checkout_idempotency_key = _idempotency_key
    and ((auth.uid() is null and orders.profile_id is null) or orders.profile_id = auth.uid())
  limit 1;
  if existing_order is not null then
    return (select jsonb_build_object('orderId', id, 'orderNumber', order_number, 'status', status, 'paymentStatus', payment_status, 'totalAmount', total_amount) from public.orders where id = existing_order);
  end if;

  detail_name := nullif(trim(_details->>'name'), '');
  detail_email := nullif(trim(_details->>'email'), '');
  detail_phone := nullif(trim(_details->>'phone'), '');
  postal_code := nullif(trim(_details->>'postalCode'), '');
  city := nullif(trim(_details->>'city'), '');
  state_name := nullif(trim(_details->>'state'), '');
  payment_method := lower(coalesce(_details->>'paymentMethod', 'cod'));

  if detail_name is null or detail_phone is null or detail_email is null
     or nullif(trim(_details->>'addressLine1'), '') is null
     or postal_code is null or postal_code !~ '^[0-9]{6}$'
     or city is null or state_name is null then
    raise exception using errcode = '22023', message = 'Required delivery details are missing';
  end if;
  if payment_method not in ('cod', 'razorpay') then
    raise exception using errcode = '22023', message = 'Unsupported payment method';
  end if;

  select public.check_delivery(postal_code, city, state_name) into delivery;
  if coalesce((delivery->>'serviceable')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'This delivery address is not currently serviceable';
  end if;

  shipping_total := coalesce((delivery->>'shipping_fee')::numeric, 0);

  /* A guest still receives a durable cart owner so the orders constraint is
     satisfied without exposing any privileged table writes to the browser. */
  guest_session := 'checkout:' || gen_random_uuid()::text;
  insert into public.carts (profile_id, session_key_hash, status, currency, expires_at)
  values (profile_id, guest_session, 'active', 'INR', now() + interval '7 days')
  returning id into cart_id;

  for item in select value from jsonb_array_elements(_items)
  loop
    if nullif(trim(item->>'variantId'), '') is null then
      raise exception using errcode = '22023', message = 'Cart item is missing its variant';
    end if;
    quantity := greatest(1, least(20, coalesce((item->>'quantity')::integer, 0)));

    select * into variant_record
    from public.product_variants
    where id = (item->>'variantId')::uuid and is_active
    for update;
    if variant_record.id is null then
      raise exception using errcode = 'P0002', message = 'A selected shoe variant is no longer available';
    end if;

    select * into product_record
    from public.products
    where id = variant_record.product_id and status = 'active';
    if product_record.id is null then
      raise exception using errcode = 'P0002', message = 'A selected product is no longer available';
    end if;

    select * into inventory_record
    from public.inventory
    where variant_id = variant_record.id
    for update;
    if inventory_record.variant_id is null then
      raise exception using errcode = 'P0002', message = 'Inventory is not configured for a selected variant';
    end if;
    if inventory_record.quantity_on_hand - inventory_record.reserved_quantity < quantity then
      raise exception using errcode = 'P0002', message = product_record.name || ' is out of stock for the selected option';
    end if;

    item_price := variant_record.price;
    subtotal := subtotal + (item_price * quantity);

    insert into public.cart_items (cart_id, variant_id, quantity, unit_price)
    values (cart_id, variant_record.id, quantity, item_price);
  end loop;

  subtotal := round(subtotal, 2);
  if subtotal >= coalesce((delivery->>'free_shipping_threshold')::numeric, 0)
     and coalesce((delivery->>'free_shipping_threshold')::numeric, 0) > 0 then
    shipping_total := 0;
  end if;

  order_status := case when payment_method = 'cod' then 'confirmed' else 'payment_pending' end;
  payment_status := 'pending';
  address := jsonb_build_object(
    'recipientName', detail_name,
    'phone', detail_phone,
    'addressLine1', trim(_details->>'addressLine1'),
    'addressLine2', nullif(trim(_details->>'addressLine2'), ''),
    'city', city,
    'state', state_name,
    'postalCode', postal_code,
    'countryCode', 'IN'
  );

  insert into public.orders (
    profile_id, cart_id, status, payment_status, fulfillment_status, currency,
    subtotal, discount_total, tax_total, shipping_total, shipping_address,
    billing_address, customer_note, metadata, placed_at, checkout_idempotency_key
  ) values (
    profile_id, cart_id, order_status, payment_status, 'unfulfilled', 'INR',
    subtotal, 0, 0, shipping_total, address, address,
    nullif(trim(_details->>'customerNote'), ''),
    jsonb_build_object('customer', jsonb_build_object('name', detail_name, 'email', detail_email, 'phone', detail_phone), 'paymentMethod', payment_method),
    now(), _idempotency_key
  ) returning id into order_id;

  for item in select value from jsonb_array_elements(_items)
  loop
    select pv.* into variant_record
    from public.product_variants pv
    where pv.id = (item->>'variantId')::uuid;
    select p.name, p.slug into product_name, product_slug
    from public.products p where p.id = variant_record.product_id;
    quantity := greatest(1, least(20, coalesce((item->>'quantity')::integer, 0)));

    insert into public.order_items (
      order_id, product_variant_id, product_name, sku, size, color, quantity,
      unit_price, discount_amount, tax_amount, metadata
    ) values (
      order_id, variant_record.id, product_name, variant_record.sku,
      variant_record.size, variant_record.color, quantity, variant_record.price,
      0, 0, jsonb_build_object('productSlug', product_slug)
    );

    update public.inventory
    set reserved_quantity = reserved_quantity + quantity
    where variant_id = variant_record.id;

    insert into public.order_inventory_allocations (order_id, variant_id, quantity, state)
    values (order_id, variant_record.id, quantity, case when payment_method = 'cod' then 'committed' else 'reserved' end);

    if payment_method = 'cod' then
      update public.inventory
      set quantity_on_hand = quantity_on_hand - quantity,
          reserved_quantity = reserved_quantity - quantity
      where variant_id = variant_record.id;
      insert into public.inventory_movements (variant_id, quantity_delta, reason, reference_type, reference_id, note)
      values (variant_record.id, -quantity, 'sale', 'order', order_id, 'COD order confirmed');
    else
      insert into public.inventory_movements (variant_id, quantity_delta, reason, reference_type, reference_id, note)
      values (variant_record.id, quantity, 'reservation', 'order', order_id, 'Razorpay payment pending');
    end if;
  end loop;

  if payment_method = 'cod' then
    insert into public.payments (order_id, provider, amount, currency, status, method)
    values (order_id, 'cod', subtotal + shipping_total, 'INR', 'created', 'cod');
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, actor_profile_id, source)
  values (order_id, null, order_status, profile_id, 'checkout');
  perform public._enqueue_order_event(order_id, 'order.created');
  if payment_method = 'cod' then perform public._enqueue_order_event(order_id, 'order.confirmed'); end if;

  update public.carts set status = 'converted', updated_at = now() where id = cart_id;
  return (select jsonb_build_object('orderId', id, 'orderNumber', order_number, 'status', status, 'paymentStatus', payment_status, 'totalAmount', total_amount) from public.orders where id = order_id);
end;
$$;

revoke all on function public.create_checkout(jsonb, jsonb, text, uuid) from public;
grant execute on function public.create_checkout(jsonb, jsonb, text, uuid) to anon, authenticated;

/* Staff status changes go through one audited function instead of direct table
   writes from the admin browser. */
create or replace function public.set_order_status(_order_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_status text;
begin
  if not public.has_permission('orders.manage') then
    raise exception using errcode = '42501', message = 'Order management permission required';
  end if;
  if _status not in ('pending','payment_pending','confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','refund_requested','returned','refunded') then
    raise exception using errcode = '22023', message = 'Invalid order status';
  end if;
  select status into current_status from public.orders where id = _order_id for update;
  if current_status is null then raise exception using errcode = 'P0002', message = 'Order not found'; end if;
  if current_status = _status then return; end if;

  if _status = 'cancelled' and current_status not in ('cancelled','refunded') then
    perform public._release_order_inventory(_order_id);
    perform public._release_order_coupon(_order_id);
    update public.orders set cancelled_at = now() where id = _order_id;
  end if;

  update public.orders set status = _status where id = _order_id;
  insert into public.order_status_history (order_id, from_status, to_status, actor_profile_id, source)
  values (_order_id, current_status, _status, auth.uid(), 'staff');
  if _status in ('confirmed','packed','shipped','out_for_delivery','delivered','cancelled','refund_requested') then
    perform public._enqueue_order_event(_order_id, 'order.' || _status);
  end if;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;



create or replace function public.save_product(_product jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_product_id uuid;
  variant jsonb;
  image jsonb;
  category_id text;
  variant_id uuid;
  existing_variant_ids uuid[] := '{}';
  desired_variant_ids uuid[] := '{}';
  status_value text := coalesce(nullif(_product->>'status',''), 'draft');
begin
  if not public.has_permission('catalog.manage') then
    raise exception using errcode = '42501', message = 'Catalog management permission required';
  end if;
  if nullif(trim(_product->>'name'), '') is null or nullif(trim(_product->>'slug'), '') is null then
    raise exception using errcode = '22023', message = 'Product name and slug are required';
  end if;
  if status_value not in ('draft','active','archived') then
    raise exception using errcode = '22023', message = 'Invalid product status';
  end if;

  begin target_product_id := (_product->>'id')::uuid; exception when others then target_product_id := null; end;
  if target_product_id is null then
    insert into public.products (slug, name, short_description, description, status, tax_rate, metadata)
    values (trim(_product->>'slug'), trim(_product->>'name'), nullif(_product->>'shortDescription',''), nullif(_product->>'description',''), status_value, coalesce((_product->>'taxRate')::numeric,0), coalesce(_product->'metadata','{}'::jsonb))
    returning id into target_product_id;
  else
    update public.products set slug=trim(_product->>'slug'), name=trim(_product->>'name'), short_description=nullif(_product->>'shortDescription',''), description=nullif(_product->>'description',''), status=status_value, tax_rate=coalesce((_product->>'taxRate')::numeric,0), metadata=coalesce(_product->'metadata','{}'::jsonb)
    where id=target_product_id;
    if not found then
      insert into public.products (id, slug, name, short_description, description, status, tax_rate, metadata)
      values (target_product_id, trim(_product->>'slug'), trim(_product->>'name'), nullif(_product->>'shortDescription',''), nullif(_product->>'description',''), status_value, coalesce((_product->>'taxRate')::numeric,0), coalesce(_product->'metadata','{}'::jsonb));
    end if;
  end if;

  delete from public.product_categories pc where pc.product_id=target_product_id;
  for category_id in select value::text from jsonb_array_elements_text(coalesce(_product->'categoryIds','[]'::jsonb)) loop
    begin
      insert into public.product_categories(product_id, category_id, is_primary)
      values(target_product_id, category_id::uuid, category_id::uuid = nullif(_product->>'primaryCategoryId','')::uuid)
      on conflict do nothing;
    exception when invalid_text_representation then null;
    end;
  end loop;

  delete from public.product_images pi where pi.product_id=target_product_id;
  for image in select value from jsonb_array_elements(coalesce(_product->'images','[]'::jsonb)) loop
    if nullif(trim(image->>'url'),'') is not null then
      insert into public.product_images(product_id, storage_path, alt_text, sort_order, is_primary)
      values(target_product_id, trim(image->>'url'), nullif(image->>'altText',''), coalesce((image->>'sortOrder')::integer,0), coalesce((image->>'isPrimary')::boolean,false));
    end if;
  end loop;

  select coalesce(array_agg(pv.id), '{}') into existing_variant_ids from public.product_variants pv where pv.product_id=target_product_id;
  for variant in select value from jsonb_array_elements(coalesce(_product->'variants','[]'::jsonb)) loop
    begin variant_id := (variant->>'id')::uuid; exception when others then variant_id := gen_random_uuid(); end;
    if variant_id = any(existing_variant_ids) then
      update public.product_variants set sku=trim(variant->>'sku'), size=nullif(variant->>'size',''), color=nullif(variant->>'color',''), option_values=coalesce(variant->'optionValues','{}'::jsonb), price=coalesce((variant->>'price')::numeric,0), compare_at_price=case when nullif(variant->>'compareAtPrice','') is null then null else (variant->>'compareAtPrice')::numeric end, currency=coalesce(nullif(variant->>'currency',''),'INR'), weight_grams=case when nullif(variant->>'weightGrams','') is null then null else (variant->>'weightGrams')::integer end, is_active=coalesce((variant->>'isActive')::boolean,true) where id=variant_id;
    else
      insert into public.product_variants(id, product_id, sku, size, color, option_values, price, compare_at_price, currency, weight_grams, is_active)
      values(variant_id, target_product_id, trim(variant->>'sku'), nullif(variant->>'size',''), nullif(variant->>'color',''), coalesce(variant->'optionValues','{}'::jsonb), coalesce((variant->>'price')::numeric,0), case when nullif(variant->>'compareAtPrice','') is null then null else (variant->>'compareAtPrice')::numeric end, coalesce(nullif(variant->>'currency',''),'INR'), case when nullif(variant->>'weightGrams','') is null then null else (variant->>'weightGrams')::integer end, coalesce((variant->>'isActive')::boolean,true));
    end if;
    insert into public.inventory(variant_id, quantity_on_hand, reorder_level)
    values(variant_id, greatest(0, coalesce((variant->>'stockQuantity')::integer,0)), greatest(0, coalesce((variant->>'reorderLevel')::integer,0)))
    on conflict (variant_id) do update set quantity_on_hand=greatest(inventory.reserved_quantity, excluded.quantity_on_hand), reorder_level=excluded.reorder_level;
    desired_variant_ids := array_append(desired_variant_ids, variant_id);
  end loop;
  update public.product_variants pv set is_active=false where pv.product_id=target_product_id and not (pv.id = any(desired_variant_ids));
  return target_product_id;
end;
$$;
revoke all on function public.save_product(jsonb) from public;
grant execute on function public.save_product(jsonb) to authenticated;

/* Safe defaults for an install that wants online ordering enabled. Operators
   can turn this off from business settings after deployment. */
insert into public.business_settings (setting_key, setting_value, description, is_public)
values
  ('store.settings', '{"onlineOrdersEnabled":true,"freeShippingThreshold":1999,"standardShippingFee":99,"deliveryEstimate":"3–7 business days"}'::jsonb, 'Operational storefront flags and checkout defaults', true)
on conflict (setting_key) do update
set setting_value = public.business_settings.setting_value || excluded.setting_value,
    is_public = true;

insert into public.delivery_areas (name, country_code, state, city, postal_code, shipping_fee, free_shipping_threshold, estimated_days_min, estimated_days_max, is_active)
values
  ('Dhanera', 'IN', 'Gujarat', 'Dhanera', '385310', 99, 1999, 2, 5, true),
  ('Gujarat', 'IN', 'Gujarat', null, null, 99, 1999, 3, 7, true)
on conflict do nothing;

commit;
