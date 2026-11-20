// STAGING ONLY: drop and recreate the public schema (and the CLI's migration history), restoring
// Supabase's default grants. Called by rebuild.ps1. Refuses the production project.
const { Client } = require('pg')
const url = process.argv[2]
if (!url) throw new Error('usage: node reset-public.cjs <staging db url>')
if (url.includes('hsabrzwsetjeaqutjrjb')) throw new Error('Refusing: that is the PRODUCTION project.')

;(async () => {
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    COMMENT ON SCHEMA public IS 'standard public schema';
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON SCHEMA public TO postgres, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DELETE FROM auth.identities; DELETE FROM auth.users;
    DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
  `)
  await db.end()
  console.log('staging public schema reset')
})().catch((e) => { console.error(e.message); process.exit(1) })
