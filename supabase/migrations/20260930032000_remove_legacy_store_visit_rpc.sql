begin;
revoke execute on function public.register_store_visit(uuid,text,text,text) from public, anon, authenticated;
commit;
