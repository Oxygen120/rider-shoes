begin;

create unique index if not exists store_visits_reference_number_uq on public.store_visits(reference_number) where reference_number is not null;

create or replace function public.register_store_visit(_name text,_phone text,_email text default null,_product_id uuid default null,_visit_date date default null,_visit_time time default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare cfg jsonb:=coalesce((select setting_value from public.business_settings where setting_key='store.settings'),'{}'::jsonb); enabled boolean:=coalesce((cfg->>'storeVisitEnabled')::boolean,true); discount_type text:=lower(coalesce(cfg->>'storeVisitDiscountType','percent')); discount_value numeric:=greatest(0,coalesce((cfg->>'storeVisitDiscount')::numeric,0)); validity_days integer:=greatest(1,coalesce((cfg->>'storeVisitValidityDays')::integer,7)); visit_id uuid; reference text; expires_at timestamptz:=now()+make_interval(days=>validity_days);
begin
 if not enabled then raise exception using errcode='22023',message='Store visit registration is currently disabled'; end if;
 if nullif(trim(_name),'') is null then raise exception using errcode='22023',message='Name is required'; end if;
 if nullif(regexp_replace(coalesce(_phone,''),'\\D','','g'),'') is null then raise exception using errcode='22023',message='Valid mobile number is required'; end if;
 if _product_id is not null and not exists(select 1 from public.products where id=_product_id and status='active') then raise exception using errcode='P0002',message='Selected product is no longer available'; end if;
 if discount_type not in ('percent','fixed') then discount_type:='percent'; end if; if discount_type='percent' then discount_value:=least(discount_value,100); end if;
 reference:='RSV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.store_visits(profile_id,path,referrer,user_agent,metadata,occurred_at,reference_number,customer_name,customer_phone,customer_email,product_id,discount_type,discount_value,expires_at,is_active)
 values(auth.uid(),'/store-visit',null,null,jsonb_build_object('visitDate',_visit_date,'visitTime',_visit_time),now(),reference,trim(_name),regexp_replace(trim(_phone),'\\D','','g'),nullif(trim(_email),''),_product_id,discount_type,discount_value,expires_at,true) returning id into visit_id;
 return jsonb_build_object('id',visit_id,'referenceNumber',reference,'expiresAt',expires_at,'discountType',discount_type,'discountValue',discount_value);
end; $$;
revoke all on function public.register_store_visit(text,text,text,uuid,date,time) from public; grant execute on function public.register_store_visit(text,text,text,uuid,date,time) to anon,authenticated;

create or replace function public.apply_store_visit_to_order() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare ref text; visit public.store_visits%rowtype; discount numeric:=0;
begin
 ref:=nullif((regexp_match(coalesce(new.customer_note,''),'STORE_VISIT_REF:([A-Za-z0-9_-]+)'))[1],''); if ref is null then return new; end if;
 select * into visit from public.store_visits where reference_number=ref and is_active=true and redeemed_order_id is null and (expires_at is null or expires_at>=now()) for update;
 if visit.id is null then raise exception using errcode='22023',message='Invalid or expired Store Visit Reference'; end if;
 if regexp_replace(coalesce((new.shipping_address->>'phone'),''),'\\D','','g')<>regexp_replace(coalesce(visit.customer_phone,''),'\\D','','g') then raise exception using errcode='22023',message='Store Visit Reference does not match this mobile number'; end if;
 if visit.discount_type='percent' then discount:=least(new.subtotal,round(new.subtotal*greatest(0,least(visit.discount_value,100))/100,2)); else discount:=least(new.subtotal,greatest(0,visit.discount_value)); end if;
 update public.orders set discount_total=discount,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('storeVisitReference',visit.reference_number,'storeVisitDiscount',discount,'storeVisitDiscountType',visit.discount_type) where id=new.id;
 update public.store_visits set redeemed_order_id=new.id,is_active=false where id=visit.id; return new;
end; $$;
drop trigger if exists orders_apply_store_visit on public.orders; create trigger orders_apply_store_visit after insert on public.orders for each row execute function public.apply_store_visit_to_order();

create or replace function public.correct_cod_payment_amount() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if new.provider='cod' then update public.payments p set amount=o.total_amount from public.orders o where p.id=new.id and o.id=new.order_id; end if; return new; end; $$;
drop trigger if exists payments_correct_cod_amount on public.payments; create trigger payments_correct_cod_amount after insert on public.payments for each row execute function public.correct_cod_payment_amount();

create or replace function public.list_admin_users() returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(jsonb_agg(row_to_json(x) order by x.email),'[]'::jsonb) from (select p.id,p.email,p.full_name,p.phone,p.is_active,coalesce(jsonb_agg(jsonb_build_object('code',r.code,'name',r.name)) filter(where r.id is not null),'[]'::jsonb) roles from public.profiles p left join public.profile_roles pr on pr.profile_id=p.id left join public.roles r on r.id=pr.role_id where public.has_permission('roles.manage') group by p.id,p.email,p.full_name,p.phone,p.is_active) x; $$;
revoke all on function public.list_admin_users() from public; grant execute on function public.list_admin_users() to authenticated;

create or replace function public.set_profile_active(_profile_id uuid,_is_active boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$ begin if not public.has_permission('roles.manage') then raise exception using errcode='42501',message='Role management permission required'; end if; if _profile_id=auth.uid() then raise exception using errcode='42501',message='You cannot deactivate your own account'; end if; update public.profiles set is_active=_is_active,updated_at=now() where id=_profile_id; if not found then raise exception using errcode='P0002',message='User not found'; end if; end; $$;
revoke all on function public.set_profile_active(uuid,boolean) from public; grant execute on function public.set_profile_active(uuid,boolean) to authenticated;

update public.business_settings set setting_value=setting_value||jsonb_build_object('storeVisitEnabled',true,'storeVisitDiscountType',coalesce(setting_value->>'storeVisitDiscountType','percent')) where setting_key='store.settings';
commit;
