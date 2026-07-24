# Ecosystem — Earlyseed Ventures

Internal deal-pipeline and CRM platform for Earlyseed Ventures, covering the full IB workflow:
deal sourcing (Deal Desk + intake pipelines), the startup database, investor CRM, active deal
management, tasks, escalations, HR/Bulletin, and multi-tenant admin.

- **Live:** https://ecosystem-liart.vercel.app
- **What's built, module by module:** [docs/FUNCTIONALITY.md](docs/FUNCTIONALITY.md)
- **Roles & permissions:** [docs/ROLES.md](docs/ROLES.md)
- **AI-agent / codebase context:** [CLAUDE.md](CLAUDE.md)
- **All other reference docs** (setup, brand guidelines, PRD, migration history): [docs/](docs/)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll need a `.env.local` with Supabase credentials first — see
[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

Built with [Next.js](https://nextjs.org) (App Router) and [Supabase](https://supabase.com).
