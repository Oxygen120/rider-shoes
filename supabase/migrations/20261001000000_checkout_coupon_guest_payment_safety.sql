create or replace function public.preview_coupon(_code text,_phone text default null,_subtotal numeric default 0)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public' as $$
declare c record; prior_orders integer:=0; phone_value text:=regexp_replace(coalesce(_phone,''),'\D','','g'); discount numeric:=0;
begin
 select * into c from public.coupons where upper(code)=upper(trim(coalesce(_code,''))) and is_active and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>=now()) and (usage_limit is null or usage_count<usage_limit) limit 1;
 if not found then return jsonb_build_object('valid',false,'message','Coupon is invalid or expired'); end if;
 if c.audience_type='single_customer' and regexp_replace(coalesce(c.target_phone,''),'\D','','g')<>phone_value then return jsonb_build_object('valid',false,'message','This coupon is not assigned to this customer'); end if;
 if c.audience_type='returning_customer' then select count(*) into prior_orders from public.orders o where o.status not in ('cancelled','refunded') and regexp_replace(coalesce(o.shipping_address->>'phone',''),'\D','','g')=phone_value; if prior_orders<1 then return jsonb_build_object('valid',false,'message','This coupon is for returning customers'); end if; end if;
 if c.target_profile_id is not null and c.target_profile_id is distinct from auth.uid() then return jsonb_build_object('valid',false,'message','This coupon is not assigned to this customer'); end if;
 if coalesce(_subtotal,0)<coalesce(c.minimum_order_amount,0) then return jsonb_build_object('valid',false,'message','Minimum order amount is ₹'||c.minimum_order_amount); end if;
 discount:=greatest(0,case when c.discount_type='percent' then _subtotal*c.discount_value/100 else c.discount_value end); if c.maximum_discount_amount is not null then discount:=least(discount,c.maximum_discount_amount); end if; discount:=least(discount,greatest(0,_subtotal));
 return jsonb_build_object('valid',true,'code',c.code,'description',c.description,'discount',discount,'showAtCheckout',c.show_at_checkout,'audienceType',c.audience_type);
end; $$;
grant execute on function public.preview_coupon(text,text,numeric) to anon,authenticated;

create or replace function public.cancel_pending_razorpay_order_guest(_order_id uuid,_phone text)
returns void language plpgsql security definer set search_path='pg_catalog','public' as $$
declare v_profile uuid; v_status text; stored_phone text; supplied_phone text;
begin
 select profile_id,status,regexp_replace(coalesce(shipping_address->>'phone',''),'\D','','g') into v_profile,v_status,stored_phone from public.orders where id=_order_id for update;
 if not found then return; end if;
 supplied_phone:=regexp_replace(coalesce(_phone,''),'\D','','g');
 if v_profile is not null and v_profile<>auth.uid() then raise exception 'Order access denied'; end if;
 if v_profile is null and (stored_phone='' or supplied_phone='' or stored_phone<>supplied_phone) then raise exception 'Order access denied'; end if;
 if v_status not in ('payment_pending','pending') then return; end if;
 update public.inventory i set reserved_quantity=greatest(0,i.reserved_quantity-oi.quantity),updated_at=now() from public.order_items oi where oi.order_id=_order_id and i.variant_id=oi.product_variant_id;
 update public.orders set status='cancelled',payment_status='failed',cancelled_at=now(),updated_at=now() where id=_order_id;
end; $$;
grant execute on function public.cancel_pending_razorpay_order_guest(uuid,text) to anon,authenticated;
revoke execute on function public.cancel_pending_razorpay_order(uuid) from anon,authenticated;

create or replace function public.create_checkout(_items jsonb,_details jsonb,_coupon text default null,_idempotency_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='pg_catalog','public' as $$
declare item jsonb; variant_row record; order_id uuid; v_order_number text; subtotal numeric:=0; shipping numeric:=0; discount numeric:=0; tax_total numeric:=0; qty integer; available integer; payment_method text:=lower(coalesce(_details->>'paymentMethod','cod')); name_value text:=nullif(trim(coalesce(_details->>'name','')),''); email_value text:=nullif(trim(coalesce(_details->>'email','')),''); phone_value text:=nullif(trim(coalesce(_details->>'phone','')),''); address_json jsonb; existing_order record; visit_row record; visit_discount numeric:=0; has_store_visit boolean:=false; store_visit_ref text:=nullif(trim(coalesce(_details->>'storeVisitReference','')),''); store_cfg jsonb:=coalesce((select setting_value from public.business_settings where setting_key='store.settings' and is_public=true limit 1),'{}'::jsonb); free_shipping_threshold numeric:=coalesce((store_cfg->>'freeShippingThreshold')::numeric,2499); standard_shipping_fee numeric:=greatest(0,coalesce((store_cfg->>'standardShippingFee')::numeric,0)); tax_included boolean:=coalesce((store_cfg->>'taxIncluded')::boolean,false); coupon_row record; coupon_id uuid:=null; prior_orders integer:=0; coupon_discount numeric:=0; effective_coupon text:=nullif(trim(coalesce(_coupon,_details->>'couponCode','')),'');
begin
 if jsonb_typeof(_items)<>'array' or jsonb_array_length(_items)=0 then raise exception using errcode='22023',message='Your bag is empty'; end if;
 if payment_method not in ('cod','razorpay') then raise exception using errcode='22023',message='Unsupported payment method'; end if;
 if name_value is null or phone_value is null or nullif(trim(coalesce(_details->>'addressLine1','')),'') is null then raise exception using errcode='22023',message='Customer name, phone and address are required'; end if;
 if store_visit_ref is null then store_visit_ref:=nullif((regexp_match(coalesce(_details->>'customerNote',''),'STORE_VISIT_REF:([A-Za-z0-9_-]+)'))[1],''); end if;
 select * into existing_order from public.orders where checkout_idempotency_key=_idempotency_key and profile_id is not distinct from auth.uid() limit 1;
 if found then return jsonb_build_object('orderId',existing_order.id,'orderNumber',existing_order.order_number,'status',existing_order.status,'paymentStatus',existing_order.payment_status,'totalAmount',existing_order.total_amount); end if;
 address_json:=jsonb_build_object('recipientName',name_value,'email',email_value,'phone',phone_value,'addressLine1',trim(_details->>'addressLine1'),'addressLine2',nullif(trim(coalesce(_details->>'addressLine2','')),''),'city',trim(coalesce(_details->>'city','')),'state',trim(coalesce(_details->>'state','')),'postalCode',trim(coalesce(_details->>'postalCode','')),'countryCode','IN');
 for item in select value from jsonb_array_elements(_items) loop
   qty:=greatest(1,least(20,coalesce((item->>'quantity')::integer,1)));
   select pv.*,p.name as product_name,p.slug as product_slug,p.tax_rate into variant_row from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(item->>'variantId')::uuid and pv.is_active and p.status='active' for update;
   if not found then raise exception using errcode='P0002',message='Product variant not found'; end if;
   select quantity_on_hand-reserved_quantity into available from public.inventory where variant_id=variant_row.id for update;
   if available is null then available:=0; end if;
   if available<qty then raise exception using errcode='P0002',message='Insufficient stock for '||variant_row.product_name; end if;
   subtotal:=subtotal+(variant_row.price*qty);
   if not tax_included then tax_total:=tax_total+round((variant_row.price*qty)*coalesce(variant_row.tax_rate,0)/100,2); end if;
 end loop;
 if subtotal<free_shipping_threshold then shipping:=standard_shipping_fee; else shipping:=0; end if;
 if upper(coalesce(effective_coupon,''))<>'' then
   select * into coupon_row from public.coupons where upper(code)=upper(effective_coupon) and is_active and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>=now()) and (usage_limit is null or usage_count<usage_limit) limit 1;
   if not found then raise exception using errcode='22023',message='Coupon is invalid or expired'; end if;
   if coupon_row.audience_type='single_customer' then if nullif(regexp_replace(coalesce(coupon_row.target_phone,''),'\D','','g'),'') is null or regexp_replace(coupon_row.target_phone,'\D','','g')<>regexp_replace(phone_value,'\D','','g') then raise exception using errcode='22023',message='This coupon is not assigned to this customer'; end if; end if;
   if coupon_row.audience_type='returning_customer' then select count(*) into prior_orders from public.orders o where o.status not in ('cancelled','refunded') and regexp_replace(coalesce(o.shipping_address->>'phone',''),'\D','','g')=regexp_replace(phone_value,'\D','','g'); if prior_orders<1 then raise exception using errcode='22023',message='This coupon is for returning customers'; end if; end if;
   if coupon_row.target_profile_id is not null and coupon_row.target_profile_id is distinct from auth.uid() then raise exception using errcode='22023',message='This coupon is not assigned to this customer'; end if;
   if subtotal<coalesce(coupon_row.minimum_order_amount,0) then raise exception using errcode='22023',message='Minimum order amount for this coupon is ₹'||coupon_row.minimum_order_amount; end if;
   coupon_discount:=greatest(0,case when coupon_row.discount_type='percent' then subtotal*coupon_row.discount_value/100 else coupon_row.discount_value end); if coupon_row.maximum_discount_amount is not null then coupon_discount:=least(coupon_discount,coupon_row.maximum_discount_amount); end if; discount:=least(coupon_discount,subtotal); coupon_id:=coupon_row.id;
 end if;
 if store_visit_ref is not null then
   select * into visit_row from public.store_visits where upper(reference_number)=upper(store_visit_ref) and is_active and redeemed_order_id is null and (expires_at is null or expires_at>=now()) for update;
   if not found then raise exception using errcode='22023',message='Store visit reference is invalid, expired, or already used'; end if;
   if regexp_replace(coalesce(visit_row.customer_phone,''),'\D','','g')<>regexp_replace(phone_value,'\D','','g') then raise exception using errcode='22023',message='Store visit mobile number does not match checkout mobile'; end if;
   has_store_visit:=true;
   if visit_row.product_id is not null and not exists(select 1 from jsonb_array_elements(_items) j join public.product_variants pv on pv.id=(j->>'variantId')::uuid where pv.product_id=visit_row.product_id) then raise exception using errcode='22023',message='This Store Visit Reference is for a different product'; end if;
   if visit_row.discount_type='percent' then visit_discount:=least(subtotal,greatest(0,subtotal*visit_row.discount_value/100)); else visit_discount:=least(subtotal,greatest(0,visit_row.discount_value)); end if;
   discount:=least(subtotal,discount+visit_discount);
 end if;
 insert into public.orders(profile_id,checkout_idempotency_key,coupon_id,status,payment_status,fulfillment_status,currency,subtotal,discount_total,tax_total,shipping_total,shipping_address,billing_address,customer_note,metadata,placed_at) values(auth.uid(),_idempotency_key,coupon_id,case when payment_method='cod' then 'confirmed' else 'payment_pending' end,'pending','unfulfilled','INR',subtotal,discount,tax_total,shipping,address_json,address_json,nullif(trim(coalesce(_details->>'customerNote','')),''),jsonb_build_object('customer',jsonb_build_object('name',name_value,'email',email_value,'phone',phone_value),'paymentMethod',payment_method,'couponCode',upper(coalesce(effective_coupon,'')),'storeVisitReference',store_visit_ref,'storeVisitDiscountApplied',has_store_visit),now()) returning id,order_number into order_id,v_order_number;
 for item in select value from jsonb_array_elements(_items) loop
   qty:=greatest(1,least(20,coalesce((item->>'quantity')::integer,1)));
   select pv.*,p.name as product_name,p.slug as product_slug,p.tax_rate into variant_row from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(item->>'variantId')::uuid;
   insert into public.order_items(order_id,product_variant_id,product_name,sku,size,color,quantity,unit_price,discount_amount,tax_amount,metadata) values(order_id,variant_row.id,variant_row.product_name,variant_row.sku,variant_row.size,variant_row.color,qty,variant_row.price,0,case when tax_included then 0 else round((variant_row.price*qty)*coalesce(variant_row.tax_rate,0)/100,2) end,jsonb_build_object('productSlug',variant_row.product_slug));
   update public.inventory set reserved_quantity=reserved_quantity+qty,updated_at=now() where variant_id=variant_row.id;
   insert into public.inventory_movements(variant_id,quantity_delta,reason,reference_type,reference_id,note,created_by) values(variant_row.id,0,'reservation','order',order_id,'Inventory reserved for checkout',auth.uid());
 end loop;
 if has_store_visit then update public.store_visits set redeemed_order_id=order_id,is_active=false where id=visit_row.id; end if;
 if coupon_id is not null then update public.coupons set usage_count=usage_count+1,updated_at=now() where id=coupon_id; insert into public.coupon_redemptions(coupon_id,order_id,profile_id,discount_amount) values(coupon_id,order_id,auth.uid(),discount); end if;
 insert into public.payments(order_id,provider,amount,currency,status,method) values(order_id,payment_method,(subtotal-discount+tax_total+shipping),'INR','created',payment_method);
 return jsonb_build_object('orderId',order_id,'orderNumber',v_order_number,'status',case when payment_method='cod' then 'confirmed' else 'payment_pending' end,'paymentStatus','pending','totalAmount',(subtotal-discount+tax_total+shipping));
end; $$;
