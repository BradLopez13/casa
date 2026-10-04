-- Functions created by the migration role must be unreachable until an RPC
-- grants EXECUTE explicitly. Supabase adds role-specific default privileges
-- for anon/authenticated/service_role in public, and PostgreSQL grants
-- EXECUTE to PUBLIC globally, so both layers are revoked.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
