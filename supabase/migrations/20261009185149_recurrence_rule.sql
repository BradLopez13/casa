-- Recurrence rules in SQL. Both functions mirror domain/recurrence (rule.ts and
-- next.ts); supabase/tests/recurrence_cases.test.sql checks them against the
-- same cases as the TypeScript tests.

-- True when p_rule has the exact shape recurrenceRuleSchema accepts:
--   {"kind":"interval","every":1..365}
--   {"kind":"weekly","days":[1..7, strictly ascending, at least one]}
--   {"kind":"monthly","day":1..31}
-- Any other shape returns false; it never raises.
create function private.valid_recurrence(p_rule jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys text[];
  v_value jsonb;
  v_number numeric;
  v_previous numeric := 0;
begin
  if jsonb_typeof(p_rule) is distinct from 'object' then
    return false;
  end if;

  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_rule) as k;

  case p_rule->'kind'
    when '"interval"' then
      if v_keys <> array['every', 'kind'] or jsonb_typeof(p_rule->'every') <> 'number' then
        return false;
      end if;
      v_number := (p_rule->>'every')::numeric;
      return v_number = trunc(v_number) and v_number between 1 and 365;

    when '"monthly"' then
      if v_keys <> array['day', 'kind'] or jsonb_typeof(p_rule->'day') <> 'number' then
        return false;
      end if;
      v_number := (p_rule->>'day')::numeric;
      return v_number = trunc(v_number) and v_number between 1 and 31;

    when '"weekly"' then
      if v_keys <> array['days', 'kind']
         or jsonb_typeof(p_rule->'days') <> 'array'
         or jsonb_array_length(p_rule->'days') = 0 then
        return false;
      end if;
      for v_value in select jsonb_array_elements(p_rule->'days') loop
        if jsonb_typeof(v_value) <> 'number' then
          return false;
        end if;
        v_number := (v_value #>> '{}')::numeric;
        if v_number <> trunc(v_number) or v_number > 7 or v_number <= v_previous then
          return false;
        end if;
        v_previous := v_number;
      end loop;
      return true;

    else
      return false;
  end case;
end;
$$;

-- First date of the rule strictly after max(p_due_on, p_today), as
-- calculateNextOccurrence. A monthly rule anchors on least(day, last day of
-- the month), looking at the base month and the next two.
create function private.next_due_on(p_rule jsonb, p_due_on date, p_today date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base date := greatest(p_due_on, p_today);
  v_candidate date;
  v_month_start date;
  v_index int;
  v_day int;
begin
  case p_rule->>'kind'
    when 'interval' then
      return v_base + (p_rule->>'every')::int;

    when 'weekly' then
      for n in 1..7 loop
        v_candidate := v_base + n;
        if p_rule->'days' @> to_jsonb(extract(isodow from v_candidate)::int) then
          return v_candidate;
        end if;
      end loop;

    when 'monthly' then
      v_day := (p_rule->>'day')::int;
      for v_offset in 0..2 loop
        v_index := extract(month from v_base)::int - 1 + v_offset;
        v_month_start := make_date(extract(year from v_base)::int + v_index / 12, v_index % 12 + 1, 1);
        v_candidate := v_month_start
          + least(v_day, extract(day from v_month_start + interval '1 month' - interval '1 day')::int)
          - 1;
        if v_candidate > v_base then
          return v_candidate;
        end if;
      end loop;

    else
      null;
  end case;

  raise exception 'invalid recurrence rule: %', p_rule using errcode = '22023';
end;
$$;

revoke execute on function private.valid_recurrence(jsonb) from public, anon, authenticated;
revoke execute on function private.next_due_on(jsonb, date, date) from public, anon, authenticated;

alter table public.task_series
  add constraint task_series_recurrence_valid
  check (recurrence_rule is null or private.valid_recurrence(recurrence_rule));
