begin;

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
  variant_row record;
  order_id uuid;
  v_order_number text;
  subtotal numeric := 0;
  shipping numeric := 0;
  discount numeric := 0;
  tax_total numeric := 0;
  qty integer;
  available integer;
  payment_method text := lower(coalesce(_details->>'paymentMethod','cod'));
  name_value text := nullif(trim(coalesce(_details->>'name','')), '');
  email_value text := nullif(trim(coalesce(_details->>'email','')), '');
  phone_value text := nullif(trim(coalesce(_details->>'phone','')), '');
  address_json jsonb;
  existing_order record;
  visit_row record;
  visit_discount numeric := 0;
  has_store_visit boolean := false;
  store_visit_ref text := nullif(trim(coalesce(_details->>'storeVisitReference','')), '');
begin
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then raise exception using errcode='22023', message='Your bag is empty'; end if;
  if payment_method not in ('cod','razorpay') then raise exception using errcode='22023', message='Unsupported payment method'; end if;
  if name_value is null or phone_value is null or nullif(trim(coalesce(_details->>'addressLine1','')), '') is null then raise exception using errcode='22023', message='Customer name, phone and address are required'; end if;

  select * into existing_order from public.orders where checkout_idempotency_key=_idempotency_key and profile_id is not distinct from auth.uid() limit 1;
  if found then
    return jsonb_build_object('orderId',existing_order.id,'orderNumber',existing_order.order_number,'status',existing_order.status,'paymentStatus',existing_order.payment_status,'totalAmount',existing_order.total_amount);
  end if;

  address_json:=jsonb_build_object('recipientName',name_value,'email',email_value,'phone',phone_value,'addressLine1',trim(_details->>'addressLine1'),'addressLine2',nullif(trim(coalesce(_details->>'addressLine2','')),''),'city',trim(coalesce(_details->>'city','')),'state',trim(coalesce(_details->>'state','')),'postalCode',trim(coalesce(_details->>'postalCode','')),'countryCode','IN');

  for item in select value from jsonb_array_elements(_items) loop
    qty:=greatest(1,least(20,coalesce((item->>'quantity')::integer,1)));
    select pv.*,p.name as product_name,p.slug as product_slug,p.tax_rate into variant_row
      from public.product_variants pv join public.products p on p.id=pv.product_id
     where pv.id=(item->>'variantId')::uuid and pv.is_active and p.status='active' for update;
    if not found then raise exception using errcode='P0002',message='Product variant not found'; end if;
    select quantity_on_hand-reserved_quantity into available from public.inventory where variant_id=variant_row.id for update;
    if available is null then available:=0; end if;
    if available<qty then raise exception using errcode='P0002',message='Insufficient stock for '||variant_row.product_name; end if;
    subtotal:=subtotal+(variant_row.price*qty);
    tax_total:=tax_total+round((variant_row.price*qty)*coalesce(variant_row.tax_rate,0)/100,2);
  end loop;

  if subtotal<999 then shipping:=79; else shipping:=0; end if;

  if upper(coalesce(_coupon,''))<>'' then
    select greatest(0,case when discount_type='percent' then subtotal*discount_value/100 else discount_value end) into discount
      from public.coupons where upper(code)=upper(_coupon) and is_active and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>=now()) and (usage_limit is null or usage_count<usage_limit) limit 1;
    discount:=least(discount,subtotal);
  end if;

  if store_visit_ref is not null then
    select * into visit_row from public.store_visits where upper(reference_number)=upper(store_visit_ref) and is_active and redeemed_order_id is null and (expires_at is null or expires_at>=now()) for update;
    if not found then raise exception using errcode='22023',message='Store visit reference is invalid, expired, or already used'; end if;
    if regexp_replace(coalesce(visit_row.customer_phone,''),'\D','','g')<>regexp_replace(phone_value,'\D','','g') then raise exception using errcode='22023',message='Store visit mobile number does not match checkout mobile'; end if;
    has_store_visit:=true;
    if visit_row.product_id is not null and not exists(select 1 from jsonb_array_elements(_items) j join public.product_variants pv on pv.id=(j->>'variantId')::uuid where pv.product_id=visit_row.product_id) then
      raise exception using errcode='22023',message='This Store Visit Reference is for a different product';
    end if;
    if visit_row.discount_type='percent' then visit_discount:=least(subtotal,greatest(0,subtotal*visit_row.discount_value/100)); else visit_discount:=least(subtotal,greatest(0,visit_row.discount_value)); end if;
    discount:=least(subtotal,discount+visit_discount);
  end if;

  insert into public.orders(profile_id,checkout_idempotency_key,status,payment_status,fulfillment_status,currency,subtotal,discount_total,tax_total,shipping_total,shipping_address,billing_address,customer_note,metadata,placed_at)
  values(auth.uid(),_idempotency_key,case when payment_method='cod' then 'confirmed' else 'payment_pending' end,'pending','unfulfilled','INR',subtotal,discount,tax_total,shipping,address_json,address_json,nullif(trim(coalesce(_details->>'customerNote','')),''),jsonb_build_object('customer',jsonb_build_object('name',name_value,'email',email_value,'phone',phone_value),'paymentMethod',payment_method,'storeVisitReference',store_visit_ref,'storeVisitDiscountApplied',has_store_visit),now())
  returning id,order_number into order_id,v_order_number;

  for item in select value from jsonb_array_elements(_items) loop
    qty:=greatest(1,least(20,coalesce((item->>'quantity')::integer,1)));
    select pv.*,p.name as product_name,p.slug as product_slug,p.tax_rate into variant_row from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(item->>'variantId')::uuid;
    insert into public.order_items(order_id,product_variant_id,product_name,sku,size,color,quantity,unit_price,discount_amount,tax_amount,metadata)
    values(order_id,variant_row.id,variant_row.product_name,variant_row.sku,variant_row.size,variant_row.color,qty,variant_row.price,0,round((variant_row.price*qty)*coalesce(variant_row.tax_rate,0)/100,2),jsonb_build_object('productSlug',variant_row.product_slug));
    update public.inventory set reserved_quantity=reserved_quantity+qty,updated_at=now() where variant_id=variant_row.id;
    insert into public.inventory_movements(variant_id,quantity_delta,reason,reference_type,reference_id,note,created_by) values(variant_row.id,0,'reservation','order',order_id,'Inventory reserved for checkout',auth.uid());
  end loop;

  if has_store_visit then update public.store_visits set redeemed_order_id=order_id,is_active=false where id=visit_row.id; end if;
  insert into public.payments(order_id,provider,amount,currency,status,method) values(order_id,payment_method,(subtotal-discount+tax_total+shipping),'INR','created',payment_method);
  return jsonb_build_object('orderId',order_id,'orderNumber',v_order_number,'status',case when payment_method='cod' then 'confirmed' else 'payment_pending' end,'paymentStatus','pending','totalAmount',(subtotal-discount+tax_total+shipping));
end;
$$;

create or replace function public.apply_store_visit_to_order()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare ref text; visit public.store_visits%rowtype; discount numeric:=0;
begin
  if coalesce(new.metadata->>'storeVisitDiscountApplied','false')='true' then return new; end if;
  ref:=nullif((regexp_match(coalesce(new.customer_note,''),'STORE_VISIT_REF:([A-Za-z0-9_-]+)'))[1],'');
  if ref is null then return new; end if;
  select * into visit from public.store_visits where reference_number=ref and is_active=true and redeemed_order_id is null and (expires_at is null or expires_at>=now()) for update;
  if visit.id is null then raise exception using errcode='22023',message='Invalid or expired Store Visit Reference'; end if;
  if regexp_replace(coalesce(new.shipping_address->>'phone',''),'\D','','g')<>regexp_replace(coalesce(visit.customer_phone,''),'\D','','g') then raise exception using errcode='22023',message='Store Visit Reference does not match this mobile number'; end if;
  if visit.discount_type='percent' then discount:=least(new.subtotal,round(greatest(0,least(visit.discount_value,100))*new.subtotal/100,2)); else discount:=least(new.subtotal,greatest(0,visit.discount_value)); end if;
  new.discount_total:=least(new.subtotal,coalesce(new.discount_total,0)+discount);
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('storeVisitReference',visit.reference_number,'storeVisitDiscount',discount,'storeVisitDiscountType',visit.discount_type,'storeVisitDiscountApplied',true);
  update public.store_visits set redeemed_order_id=new.id,is_active=false where id=visit.id;
  return new;
end;
$$;

create or replace function public.correct_cod_payment_amount()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.provider='cod' then
    update public.payments p set amount=(select o.total_amount from public.orders o where o.id=new.order_id) where p.id=new.id;
  end if;
  return new;
end;
$$;

notify pgrst,'reload schema';
commit;