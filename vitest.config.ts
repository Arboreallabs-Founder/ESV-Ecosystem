import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Two suites:
 *  - tests/unit         pure logic, no network. `npm test`
 *  - tests/integration  drives the real /api/mcp endpoint against the STAGING Supabase project, with
 *                       real users, RLS and triggers. `npm run test:integration` — needs a dev server
 *                       pointed at staging and .env.staging.local; see tests/integration/README.md.
 *                       Never point it at production.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
