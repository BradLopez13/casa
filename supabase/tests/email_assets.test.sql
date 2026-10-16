begin;
select plan(3);

select ok(
  (select public from storage.buckets where id = 'email-assets'),
  'email-assets bucket exists and is public'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'email-assets'),
  array['image/png'],
  'email-assets only accepts PNG'
);

select is_empty(
  $$ select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       and coalesce(qual, '') || coalesce(with_check, '') like '%email-assets%' $$,
  'no client policy can write to email-assets'
);

select * from finish();
rollback;
