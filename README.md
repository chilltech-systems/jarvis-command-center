# Ava

Ava is the private personal and business AI operating system dashboard for Cody
Hill and CHILL TECH. It brings daily attention, tasks, calendar context,
projects, intelligence signals, and automation health into one command center.

The root route now presents the standalone Mind of AVA experience: a cinematic
Three.js visualization of Ava's procedural cognitive core. The operational
dashboard home is available at `/dashboard`.

The original automation infrastructure is preserved. Some internal files,
database tables, API routes, workflow exports, and environment variables still
use `jarvis` names for compatibility with the existing Supabase, n8n, and Codex
runner contracts.

## Key Assets

- `app/` - private Next.js Ava dashboard
- `app/page.tsx` - standalone Mind of AVA WebGL experience
- `app/dashboard/page.tsx` - Ava dashboard home
- `components/ava-mind/` - React Three Fiber scene layers and interface overlay
- `lib/neural-generation.ts` - seeded procedural cognition graph generation
- `lib/cognitive-regions.ts` - stable cognitive region geometry and metadata
- `lib/performance-profile.ts` - adaptive desktop, medium, and mobile profiles
- `lib/mock-data/ava.ts` - mock data for non-live Ava tabs
- `app/api/ava/` - placeholder Ava JSON API routes
- `n8n/workflows/jarvis-command-center.json`
- `n8n/workflows/jarvis-execution-collector.json`
- `n8n/workflows/morning-standup-delivery.json`
- `n8n/workflows/morning-standup-delivery.sample.json`
- `supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql`
- `scripts/validate-n8n-workflow-json.js`
- `scripts/validate-execution-collector.js`
- `scripts/validate-business-pulse-variants.js`
- `scripts/validate-hud-auth.js`
- `scripts/validate-jarvis-assistant-foundation.js`
- `scripts/send-standup-delivery.js`
- `lib/jarvis/` - preserved assistant tools, permissions, and integration registry
- `docs/jarvis-assistant-phase1.md`
- `docs/jarvis-integration-inventory.md`

Shared n8n credentials remain outside this repository at
`/Users/c.hill/Documents/Projects/.secrets/n8n.env`.

## Local Development

```bash
npm install
npm run dev
```

Open the local Next.js URL. `/` loads the Mind of AVA experience without
dashboard chrome. Sign in with an approved Google account for protected
dashboard routes such as `/dashboard`, `/tasks`, `/runtime`, and `/settings`.

## Mind of AVA Architecture

The visualization uses seeded procedural geometry so the neural layout stays
stable while authenticated live Cognitive Core state drives focus, activity,
health tone, signal choreography, memory recall, and event intensity.

Primary layers:

- Instanced neural nodes with per-node size, importance, pulse, drift, and
  region metadata.
- Batched synaptic connections using shared buffer geometry and a shader
  material.
- Traveling signal pulses between cognitive regions.
- Transparent holographic membrane with Fresnel glow, scan lines, animated
  interference, and pointer ripples.
- Sparse atmosphere, broken holographic rings, inner core energy, and grounding
  reflection.
- Custom drag rotation, inertia, hover awareness, swoosh displacement, and
  major-node focus cards.
- A live schema-v2 state director, cinematic awakening, event-processing paths,
  memory constellation, ambient showcase mode, and opt-in audio cues.
- Authenticated WebRTC voice sessions whose tool calls route back through the
  existing Jarvis permission and approval API.

The external bearer-token `/api/ava/nebula-feed` contract remains schema v1.
The immersive browser uses the admin-only `/api/ava/nebula-state` schema-v2
route, and no feed or OpenAI secret is exposed to client code.

## Validation

Before considering changes complete, run:

```bash
npm run lint
npm run build
npm run validate:nebula
```
