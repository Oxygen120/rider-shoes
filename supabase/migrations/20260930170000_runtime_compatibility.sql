-- Runtime compatibility fixes discovered while auditing the live Rider Shoes project.
-- Keep the database contract aligned with the current frontend RPC calls.

-- Remove the legacy 4-argument overload so PostgREST has one unambiguous
-- register_store_visit function for the current Store Visit flow.
drop function if exists public.register_store_visit(uuid, text, text, text);

-- The current admin UI uses a single selected role, while an older UI contract
-- called this plural function name. Keep a compatibility wrapper around the
-- canonical, permission-checked single-role function.
create or replace function public.set_profile_roles(_profile_id uuid, _role_codes text[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(array_length(_role_codes, 1), 0) < 1 then
    raise exception using errcode = '22023', message = 'At least one role is required';
  end if;

  perform public.set_profile_role(_profile_id, _role_codes[1]);
end;
$$;

grant execute on function public.set_profile_roles(uuid, text[]) to authenticated;

-- Make the new/changed RPC signatures visible to PostgREST immediately.
notify pgrst, 'reload schema';
