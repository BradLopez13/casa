-- valid_recurrence accepts any integral JSON number, including non-canonical
-- ones such as 3.0. A plain ::int cast rejects their text ("3.0"), so
-- next_due_on reads every and day through numeric. The body is otherwise the
-- same as in 20261009185149_recurrence_rule.sql; create or replace keeps the
-- revoked privileges.

-- First date of the rule strictly after max(p_due_on, p_today), as
-- calculateNextOccurrence. A monthly rule anchors on least(day, last day of
-- the month), looking at the base month and the next two.
create or replace function private.next_due_on(p_rule jsonb, p_due_on date, p_today date)
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
      return v_base + (p_rule->>'every')::numeric::int;

    when 'weekly' then
      for n in 1..7 loop
        v_candidate := v_base + n;
        if p_rule->'days' @> to_jsonb(extract(isodow from v_candidate)::int) then
          return v_candidate;
        end if;
      end loop;

    when 'monthly' then
      v_day := (p_rule->>'day')::numeric::int;
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
