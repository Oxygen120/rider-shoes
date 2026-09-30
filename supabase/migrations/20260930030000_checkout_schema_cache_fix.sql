begin;

alter table public.orders
  add column if not exists checkout_idempotency_key uuid;

create unique index if not exists orders_profile_checkout_idempotency_key_uidx
  on public.orders(profile_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null and profile_id is not null;

notify pgrst, 'reload schema';

commit;
