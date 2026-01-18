-- ============================================
-- Move Extensions to Dedicated Schema
-- Best practice: Keep extensions out of public schema
-- ============================================

-- 1. Create dedicated extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Grant usage to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 3. Move pg_net extension to extensions schema
-- Note: We need to drop and recreate since ALTER EXTENSION SET SCHEMA 
-- may not work for all extensions
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;

-- 4. Add extensions schema to search path for functions that need it
-- This ensures existing code continues to work
ALTER DATABASE postgres SET search_path TO public, extensions;