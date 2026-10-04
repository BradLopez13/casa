-- Functions created by the migration role must be unreachable until an RPC
-- grants EXECUTE explicitly.
--
-- Supabase adds role-specific default privileges that give anon,
-- authenticated and service_role EXECUTE on new functions in public; those
-- are removed per schema below.
--
-- The PUBLIC revoke is GLOBAL for role postgres (every schema, not only
-- public/private): PostgreSQL grants EXECUTE to PUBLIC by built-in default,
-- and schema-scoped default privileges cannot remove that global grant.
-- Effect: any function postgres creates from now on (migrations, dashboard
-- SQL editor, Auth hooks, helpers called by other roles) needs an explicit
-- GRANT EXECUTE. Existing functions are unaffected.
-- To undo the global part:
--   alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;
