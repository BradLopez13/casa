-- Google and Apple put the person's name in raw_user_meta_data as full_name / name.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        split_part(new.email, '@', 1)
      ),
      40
    )
  );
  return new;
end;
$$;

-- Apple only sends the name on the first sign-in, from the client. Lets the app
-- replace the email-derived default once; never overwrites a name the user chose.
create function public.set_provider_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := trim(p_name);
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  update public.profiles p
  set display_name = v_name
  where p.user_id = v_user
    and p.display_name = (
      select left(split_part(u.email, '@', 1), 40)
      from auth.users u
      where u.id = v_user
    );
end;
$$;

revoke all on function public.set_provider_display_name(text) from public, anon;
grant execute on function public.set_provider_display_name(text) to authenticated;
