import { defineConfig } from 'vitest/config'
import path from 'node:path'

// End-to-end tests of /api/mcp against the STAGING Supabase project. See tests/integration/README.md.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/seed.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // One file, in order: later steps build on earlier ones (entry → move → reject).
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
