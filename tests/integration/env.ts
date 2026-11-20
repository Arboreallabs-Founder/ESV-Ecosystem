import fs from 'node:fs'
import path from 'node:path'

/**
 * Staging connection details, from .env.staging.local (gitignored). Refuses to return anything that
 * points at production — these tests create users, companies, entries and deals.
 */
const PRODUCTION_REF = 'hsabrzwsetjeaqutjrjb'

function load(): Record<string, string> {
  const file = path.resolve(__dirname, '../../.env.staging.local')
  if (!fs.existsSync(file)) throw new Error('Missing .env.staging.local — see tests/integration/README.md')
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) out[m[1]] = m[2]
  }
  return out
}

const env = load()
export const STAGING = {
  url: env.STAGING_SUPABASE_URL,
  publishableKey: env.STAGING_SUPABASE_PUBLISHABLE_KEY,
  dbUrl: env.STAGING_DB_POOLER_URL,
  /** The Next dev server running against staging (see README). */
  appUrl: process.env.MCP_TEST_APP_URL ?? 'http://localhost:3123',
}

for (const [k, v] of Object.entries(STAGING)) {
  if (!v) throw new Error(`Staging setting ${k} is missing`)
  if (String(v).includes(PRODUCTION_REF)) throw new Error(`Refusing to run integration tests against production (${k}).`)
}

/** Fixed ids so the seed is idempotent and tests can refer to them. */
export const IDS = {
  org: '00000000-0000-4000-a000-000000000001',
  founder: '00000000-0000-4000-a000-0000000000f1',
  associate: '00000000-0000-4000-a000-0000000000a1',
  general: '00000000-0000-4000-a000-0000000000b1',
  referrals: '00000000-0000-4000-a000-000000000101',
  otherPipeline: '00000000-0000-4000-a000-000000000102',
  stLead: '00000000-0000-4000-a000-000000000201',
  stIntro: '00000000-0000-4000-a000-000000000202',
  stAccepted: '00000000-0000-4000-a000-000000000203',
  stRejected: '00000000-0000-4000-a000-000000000204',
  stOtherLead: '00000000-0000-4000-a000-000000000205',
  stageTask: '00000000-0000-4000-a000-000000000301',
}

export const PASSWORD = 'Staging-Test-Only-9f3c!'
export const EMAILS = {
  founder: 'founder@staging.test',
  associate: 'associate@staging.test',
  general: 'general@staging.test',
}
