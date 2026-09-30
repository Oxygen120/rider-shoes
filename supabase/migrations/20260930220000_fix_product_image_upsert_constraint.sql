begin;

-- save_product upserts product images by product_id + storage_path.
-- The table previously only had the surrogate id primary key, so
-- ON CONFLICT (product_id, storage_path) could not find an arbiter.
create unique index if not exists product_images_product_storage_path_uidx
  on public.product_images (product_id, storage_path);

notify pgrst, 'reload schema';
commit;
