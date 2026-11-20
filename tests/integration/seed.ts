import { Client } from 'pg'
import { STAGING, IDS, EMAILS, PASSWORD } from './env'

/**
 * Seeds the staging project with what the integration tests need. Idempotent (fixed ids, upserts).
 *
 *  - one org; a founder, an associate and a general user (auth + public.users), password sign-in
 *  - "ESV Referrals": Lead → Introductory call → Accepted / Rejected, where entering Introductory
 *    call raises "Schedule Call with Startup" for the entry's assignees — the automation under test
 *  - a second pipeline, to prove a stage from another pipeline is refused
 *
 * Runs as vitest globalSetup, over the IPv4 session pooler as the postgres role.
 */
export default async function seed() {
  const db = new Client({ connectionString: STAGING.dbUrl, ssl: { rejectUnauthorized: false } })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(
      `INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Staging Test Org', 'staging-test')
       ON CONFLICT (id) DO NOTHING`, [IDS.org])

    for (const [role, id] of [['founder', IDS.founder], ['associate', IDS.associate], ['general', IDS.general]] as const) {
      const email = EMAILS[role]
      // Allowlist first: production's handle_new_user trigger on auth.users builds the users row from
      // approved_emails. Optional insert — its column set has varied — so under a savepoint, because a
      // failed statement would otherwise abort the whole transaction even though the error is caught.
      await db.query('SAVEPOINT approved')
      try {
        await db.query(`INSERT INTO public.approved_emails (email, name, role, org_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [email, `Test ${role}`, role, IDS.org])
        await db.query('RELEASE SAVEPOINT approved')
      } catch {
        await db.query('ROLLBACK TO SAVEPOINT approved')
      }
      await db.query(
        `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                                 raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                                 confirmation_token, recovery_token, email_change_token_new, email_change)
         VALUES ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
                 crypt($3, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
         ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password`, [id, email, PASSWORD])
      await db.query(
        `INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now(), now())
         ON CONFLICT (provider_id, provider) DO NOTHING`, [id, email])
      // Belt and braces if the trigger didn't create it (or the allowlist insert was skipped).
      await db.query(
        `INSERT INTO public.users (id, email, name, role, org_id) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, org_id = EXCLUDED.org_id`,
        [id, email, `Test ${role[0].toUpperCase()}${role.slice(1)}`, role, IDS.org])
    }

    await db.query(
      `INSERT INTO public.pipelines (id, name, description, org_id, created_by) VALUES
         ($1, 'ESV Referrals', 'Integration test pipeline', $3, $4),
         ($2, 'Other Pipeline', 'Integration test pipeline', $3, $4)
       ON CONFLICT (id) DO NOTHING`, [IDS.referrals, IDS.otherPipeline, IDS.org, IDS.founder])
    await db.query(
      `INSERT INTO public.pipeline_stages (id, pipeline_id, name, color, position, stage_type) VALUES
         ($1, $6, 'Lead', '#745FFD', -1, 'lead'),
         ($2, $6, 'Introductory call', '#D5AE8F', 1, 'custom'),
         ($3, $6, 'Accepted', '#16a34a', 998, 'accepted'),
         ($4, $6, 'Rejected', '#dc2626', 999, 'rejected'),
         ($5, $7, 'Lead', '#745FFD', -1, 'lead')
       ON CONFLICT (id) DO NOTHING`,
      [IDS.stLead, IDS.stIntro, IDS.stAccepted, IDS.stRejected, IDS.stOtherLead, IDS.referrals, IDS.otherPipeline])
    await db.query(
      `INSERT INTO public.pipeline_stage_tasks (id, stage_id, org_id, title, assign_to, due_days, priority)
       VALUES ($1, $2, $3, 'Schedule Call with Startup', 'assignees', 2, 'High')
       ON CONFLICT (id) DO NOTHING`, [IDS.stageTask, IDS.stIntro, IDS.org])
    await db.query('COMMIT')
  } catch (e) {
    await db.query('ROLLBACK')
    throw e
  } finally {
    await db.end()
  }
}
