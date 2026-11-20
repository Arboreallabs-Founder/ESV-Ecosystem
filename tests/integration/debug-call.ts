// Ad-hoc: call one tool on staging as a seeded user and print the raw result.
//   npx tsx tests/integration/debug-call.ts associate list_deals '{"owner_id":"me","state":"dormant"}'
import { tokenFor, callTool } from './mcp-client'

const [role = 'associate', tool = 'whoami', args = '{}'] = process.argv.slice(2)
;(async () => {
  const t0 = Date.now()
  const r = await callTool(await tokenFor(role as 'founder' | 'associate' | 'general'), tool, JSON.parse(args))
  console.log(`isError=${r.isError} in ${Date.now() - t0}ms`)
  console.log(r.text.slice(0, 1500))
})().catch((e) => { console.error(e); process.exit(1) })
