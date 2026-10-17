-- The person edits their own visible name from Ajustes. Same rule as the column check and
-- set_provider_display_name (1 to 40 characters once trimmed), but it always replaces the name.
-- The column update grant stays; the RPC gives the app one validated path with a named error.
create function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(p_name);
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = 'P0001';
  end if;

  update public.profiles p
  set display_name = v_name
  where p.user_id = v_user;
end;
$$;

revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
