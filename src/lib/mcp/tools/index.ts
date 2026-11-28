import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTaskTools } from './tasks'
import { registerCompanyTools } from './companies'
import { registerPipelineTools } from './pipelines'
import { registerDealTools } from './deals'
import { registerTeamTools } from './team'
import { registerTodoTools } from './todos'

/**
 * Every tool the Ecosystem connector exposes. See shared.ts for the rules they all follow and
 * docs/MCP.md for the list with parameters. No delete tools, on purpose.
 */
export function registerTools(server: McpServer) {
  registerTaskTools(server)
  registerCompanyTools(server)
  registerPipelineTools(server)
  registerDealTools(server)
  registerTeamTools(server)
  registerTodoTools(server)
}
