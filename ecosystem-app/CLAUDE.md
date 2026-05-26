# Earlyseed Ventures (ESV) Ecosystem App Context

## Project Overview
Ecosystem is the unified deal pipeline and CRM platform for Earlyseed Ventures, covering the full IB workflow. It replaces Google Sheets, WhatsApp, and Docs. 

## Current Status (May 2026)
- **Initialized:** Next.js (App Router) project created in `ecosystem-app`.
- **Database:** Supabase Cloud Project (`hsabrzwsetjeaqutjrjb`) created via MCP. Initial schema (Deals, Partners, Notes, Investors, History) applied to the cloud DB.
- **Currently Doing:** Building the Authentication UI. Due to strict Supabase free-tier rate limits (3 sign-ups/hr), we are wiring the login screen first so we can manually register a test user, bypass email confirmation via SQL, and then implement the Row-Level Security (RLS) policies.
- **Next Up:** RLS Policies, Kanban Pipeline View, Deal Details.

## Tech Stack
- **Frontend Framework:** Next.js (React) App Router
- **Styling:** Vanilla CSS (Tailwind config removed as per strict system instructions; all styling must use standard CSS).
- **Backend & Auth:** Supabase Cloud
- **Components:** Custom built; no external dense UI libraries.

## Design & Brand Guidelines
The app must feel premium, using rich aesthetics and smooth interactions.

### Default Theme: ESV Brand
- **Primary Action:** Purple `#745FFD` (CTAs, active states)
- **Primary Light:** Pastel Purple `#CEAAFD` (Hover, tags)
- **Page Background:** Crema `#F7ECE2` (Light) / Deep Navy `#1A1A2E` (Dark)
- **Card Surface:** Fair `#F4F4F4` (Light) / Dark Raised `#22223A` (Dark)
- **Body Text:** Dark `#2C2C3A` (Light) / Off-White `#F0EDE8` (Dark)
- **Muted Text:** Slate `#A39B95`
- **Border / Divider:** Sand `#D3C1A9` (Light) / Dark Border `#3A3A5C` (Dark)
- **Warm Accent:** Bronze `#D5AE8F` (Franchise tags)

### Key UX Principles
- Clean and minimal — data surfaces first.
- Spacious card-based layout (no dense tables as the default).
- ESV brand palette strictly followed.
- Both light and dark mode supported (implemented via CSS variables).
- Role-aware UI (Founder, Admin, Associate, Franchise Partner).
