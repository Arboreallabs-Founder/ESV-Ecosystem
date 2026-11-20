// Prints a STAGING access token for a seeded test user, for manual checks with the MCP Inspector:
//   npx tsx tests/integration/print-token.ts associate
import { tokenFor } from './mcp-client'

const role = (process.argv[2] ?? 'associate') as 'founder' | 'associate' | 'general'
tokenFor(role).then((t) => console.log(t)).catch((e) => { console.error(e.message); process.exit(1) })
