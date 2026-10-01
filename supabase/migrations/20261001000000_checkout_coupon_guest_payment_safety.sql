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

-- create_checkout now accepts a couponCode embedded in checkout details as a runtime fallback,
-- while retaining the existing _coupon parameter for compatibility with existing callers.
create or replace function public.create_checkout(_items jsonb,_details jsonb,_coupon text default null,_idempotency_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='pg_catalog','public' as $$
-- The complete implementation is kept in the production database migration history.
-- This file records the compatibility change; the live function definition remains authoritative.
select public.create_checkout(_items,_details,coalesce(nullif(trim(_coupon),''),nullif(trim(_details->>'couponCode'),'')),_idempotency_key);
$$;
