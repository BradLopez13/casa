-- Public bucket for the images in the auth emails (the Nido symbol). Mail clients load them
-- from the public URL, so the bucket is public; nothing in it is private. No upload policy:
-- only the service role (CLI / dashboard) writes here.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('email-assets', 'email-assets', true, array['image/png'], 1048576)
on conflict (id) do nothing;
