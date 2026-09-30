begin;

create or replace function public.set_store_visit_active(_visit_id uuid,_is_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.has_permission('analytics.read') then
    raise exception using errcode='42501',message='Store visit management permission required';
  end if;
  update public.store_visits
     set is_active=_is_active
   where id=_visit_id
     and redeemed_order_id is null;
  if not found then
    raise exception using errcode='P0002',message='Store visit not found or already checked out';
  end if;
end;
$$;
revoke all on function public.set_store_visit_active(uuid,boolean) from public;
grant execute on function public.set_store_visit_active(uuid,boolean) to authenticated;

create or replace function public.apply_store_visit_to_order()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  ref text;
  visit public.store_visits%rowtype;
  discount numeric:=0;
  product_match boolean:=true;
begin
  ref:=nullif((regexp_match(coalesce(new.customer_note,''),'STORE_VISIT_REF:([A-Za-z0-9_-]+)'))[1],'');
  if ref is null then return new; end if;
  select * into visit
    from public.store_visits
   where reference_number=ref
     and is_active=true
     and redeemed_order_id is null
     and (expires_at is null or expires_at>=now())
   for update;
  if visit.id is null then raise exception using errcode='22023',message='Invalid or expired Store Visit Reference'; end if;
  if regexp_replace(coalesce((new.shipping_address->>'phone'),''),'\\D','','g')<>regexp_replace(coalesce(visit.customer_phone,''),'\\D','','g') then
    raise exception using errcode='22023',message='Store Visit Reference does not match this mobile number';
  end if;
  if visit.product_id is not null then
    select exists(
      select 1
        from public.order_items oi
        join public.product_variants pv on pv.id=oi.product_variant_id
       where oi.order_id=new.id and pv.product_id=visit.product_id
    ) into product_match;
    if not product_match then raise exception using errcode='22023',message='This Store Visit Reference is bound to a different product'; end if;
  end if;
  if visit.discount_type='percent' then discount:=least(new.subtotal,round(new.subtotal*greatest(0,least(visit.discount_value,100))/100,2));
  else discount:=least(new.subtotal,greatest(0,visit.discount_value)); end if;
  update public.orders
     set discount_total=discount,
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('storeVisitReference',visit.reference_number,'storeVisitDiscount',discount,'storeVisitDiscountType',visit.discount_type)
   where id=new.id;
  update public.store_visits set redeemed_order_id=new.id,is_active=false where id=visit.id;
  return new;
end;
$$;

drop trigger if exists orders_apply_store_visit on public.orders;
create trigger orders_apply_store_visit after insert on public.orders for each row execute function public.apply_store_visit_to_order();

notify pgrst,'reload schema';
commit;
