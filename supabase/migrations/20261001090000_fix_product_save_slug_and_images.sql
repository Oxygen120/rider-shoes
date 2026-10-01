begin;

-- Product save hardening:
-- 1) generate a slug when the admin leaves Slug blank;
-- 2) avoid duplicate slugs by suffixing -2, -3, ...;
-- 3) accept either storagePath or the public product-image URL from the admin image uploader;
-- 4) preserve the existing MRP/selling-price mapping (compareAtPrice/price).
create or replace function public.save_product(_product jsonb)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_product_id uuid; v_variant_id uuid; existing_variant_ids uuid[] := '{}'::uuid[]; item jsonb; image_item jsonb;
  category_value text; v_category_id uuid; variant_sku text; variant_price numeric; variant_compare numeric; variant_size text; variant_color text;
  variant_currency text; variant_weight integer; stock_quantity integer; v_brand_id uuid; v_slug text; v_base_slug text; v_suffix integer; v_storage_path text;
begin
  if not public.has_permission('catalog.manage') then raise exception using errcode='42501', message='Catalog management permission required'; end if;
  if jsonb_typeof(_product) <> 'object' then raise exception using errcode='22023', message='Product payload is invalid'; end if;
  begin v_product_id := nullif(_product->>'id','')::uuid; exception when invalid_text_representation then v_product_id := null; end;
  if v_product_id is null then v_product_id := gen_random_uuid(); end if;
  begin v_brand_id := nullif(_product->'brand'->>'id','')::uuid; exception when invalid_text_representation then v_brand_id := null; end;
  if v_brand_id is not null and not exists(select 1 from public.brands b where b.id=v_brand_id) then v_brand_id := null; end if;
  if nullif(trim(_product->>'name'),'') is null then raise exception using errcode='22023',message='Product name is required'; end if;
  v_slug := nullif(trim(_product->>'slug'),'');
  if v_slug is null then v_slug := regexp_replace(lower(trim(_product->>'name')),'[^a-z0-9]+','-','g'); v_slug := regexp_replace(v_slug,'^-+|-+$','','g'); end if;
  if nullif(v_slug,'') is null then raise exception using errcode='22023',message='Product slug is required'; end if;
  v_base_slug := v_slug; v_suffix := 2;
  while exists(select 1 from public.products p where lower(p.slug)=lower(v_slug) and p.id<>v_product_id) loop v_slug := v_base_slug || '-' || v_suffix::text; v_suffix := v_suffix + 1; end loop;
  insert into public.products(id,brand_id,slug,name,short_description,description,status,tax_rate,metadata)
  values(v_product_id,v_brand_id,v_slug,trim(_product->>'name'),nullif(_product->>'shortDescription',''),nullif(_product->>'description',''),case when (_product->>'status') in ('draft','active','archived','out_of_stock') then _product->>'status' else 'active' end,greatest(0,least(100,coalesce((_product->>'taxRate')::numeric,0))),case when jsonb_typeof(_product->'metadata')='object' then _product->'metadata' else '{}'::jsonb end)
  on conflict(id) do update set brand_id=excluded.brand_id,slug=excluded.slug,name=excluded.name,short_description=excluded.short_description,description=excluded.description,status=excluded.status,tax_rate=excluded.tax_rate,metadata=excluded.metadata,updated_at=now();
  delete from public.product_categories pc where pc.product_id=v_product_id;
  for category_value in select value from jsonb_array_elements_text(coalesce(_product->'categoryIds','[]'::jsonb)) loop
    begin v_category_id:=category_value::uuid; exception when invalid_text_representation then v_category_id:=null; end;
    if v_category_id is not null and exists(select 1 from public.categories c where c.id=v_category_id) then
      insert into public.product_categories(product_id,category_id,is_primary) values(v_product_id,v_category_id,v_category_id::text=nullif(_product->>'primaryCategoryId','')) on conflict(product_id,category_id) do update set is_primary=excluded.is_primary;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(_product->'variants','[]'::jsonb)) loop
    variant_sku:=nullif(trim(item->>'sku'),''); if variant_sku is null then raise exception using errcode='22023',message='Every product variant needs an SKU'; end if;
    variant_price:=greatest(0,coalesce((item->>'price')::numeric,0)); variant_compare:=nullif(item->>'compareAtPrice','')::numeric; if variant_compare is not null and variant_compare<variant_price then variant_compare:=variant_price; end if;
    variant_size:=nullif(trim(item->>'size'),''); variant_color:=nullif(trim(item->>'color'),''); variant_currency:=upper(coalesce(nullif(item->>'currency',''),'INR')); if variant_currency !~ '^[A-Z]{3}$' then variant_currency:='INR'; end if;
    variant_weight:=nullif(item->>'weightGrams','')::integer; stock_quantity:=greatest(0,coalesce((item->>'stockQuantity')::integer,0));
    begin v_variant_id:=nullif(item->>'id','')::uuid; exception when invalid_text_representation then v_variant_id:=null; end;
    if v_variant_id is null or not exists(select 1 from public.product_variants pv where pv.id=v_variant_id and pv.product_id=v_product_id) then v_variant_id:=gen_random_uuid(); end if;
    insert into public.product_variants(id,product_id,sku,size,color,option_values,price,compare_at_price,currency,weight_grams,is_active)
    values(v_variant_id,v_product_id,variant_sku,variant_size,variant_color,case when jsonb_typeof(item->'optionValues')='object' then item->'optionValues' else '{}'::jsonb end,variant_price,variant_compare,variant_currency,variant_weight,true)
    on conflict(id) do update set sku=excluded.sku,size=excluded.size,color=excluded.color,option_values=excluded.option_values,price=excluded.price,compare_at_price=excluded.compare_at_price,currency=excluded.currency,weight_grams=excluded.weight_grams,is_active=true,updated_at=now();
    existing_variant_ids:=array_append(existing_variant_ids,v_variant_id);
    insert into public.inventory(variant_id,quantity_on_hand) values(v_variant_id,stock_quantity)
    on conflict(variant_id) do update set quantity_on_hand=greatest(0,excluded.quantity_on_hand),reserved_quantity=least(inventory.reserved_quantity,greatest(0,excluded.quantity_on_hand)),updated_at=now();
  end loop;
  update public.product_variants pv set is_active=false,updated_at=now() where pv.product_id=v_product_id and (cardinality(existing_variant_ids)=0 or pv.id<>all(existing_variant_ids));
  for image_item in select value from jsonb_array_elements(coalesce(_product->'images','[]'::jsonb)) loop
    v_storage_path := nullif(trim(coalesce(image_item->>'storagePath','')),'');
    if v_storage_path is null then v_storage_path := nullif(regexp_replace(coalesce(image_item->>'url',''), '^.*?/storage/v1/object/public/product-images/', ''), ''); end if;
    if v_storage_path is not null and v_storage_path <> coalesce(image_item->>'url','') then
      insert into public.product_images(product_id,storage_path,alt_text,sort_order,is_primary)
      values(v_product_id,v_storage_path,nullif(image_item->>'altText',''),coalesce((image_item->>'sortOrder')::integer,0),coalesce((image_item->>'isPrimary')::boolean,false))
      on conflict(product_id,storage_path) do update set alt_text=excluded.alt_text,sort_order=excluded.sort_order,is_primary=excluded.is_primary,updated_at=now();
    end if;
  end loop;
  return v_product_id;
end; $$;

revoke all on function public.save_product(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;
commit;
