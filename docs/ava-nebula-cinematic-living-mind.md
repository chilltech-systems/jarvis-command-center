# Ava Nebula: Cinematic Living Mind

## Runtime flow

```text
Cognitive Core
-> Nebula schema v2
-> visual-state director
-> compact orb home
-> in-place cognition drill-in
-> Three.js cinematic scene layers
-> live HUD, event paths, focus, memory, and sound
```

The public server-to-server `/api/ava/nebula-feed` remains a bearer-token,
schema-v1 contract. The immersive browser reads `/api/ava/nebula-state`, which
requires an authenticated Jarvis admin in production and never returns secrets.

## Orb home and drill-in

- Every fresh load starts in the compact blue orb home. It shows live system
  status, but with quieter breathing, signals, fog, and no cinematic controls.
- The central orb is the sole entry target. Selecting it runs the client-only
  `home -> entering -> cognition` transition without navigating or reloading.
- Cognition opens on the live focus region when one is available. Region
  selection, focus cards, event content, drag gestures, Recall, and voice
  controls remain inside the expanded state.
- A verified click beyond the neural field runs the reverse
  `cognition -> exiting -> home` transition. Exit clears focus and Recall,
  disables showcase, and stops any active realtime voice session.
- Reduced-motion users receive a short scale/crossfade transition. Mobile uses
  a larger central hit target and suppresses secondary home labels.

## Cinematic states

- Mission status drives calm, focus, warning, or critical tone.
- Current focus increases activity in the corresponding cognitive region.
- Recent events travel through Awareness, Attention, Reasoning, and their
  destination region; high and critical events add restrained shockwaves.
- First visit uses a four-second awakening. Repeat visits use a shorter resume
  sequence, and reduced-motion users enter the ready state immediately.
- Recall mode uses existing `jarvis_memory` records, with recent cognitive
  events as a visual fallback when no persisted records are available.
- Ambient showcase begins after 25 seconds without interaction and exits on
  pointer, keyboard, touch, or voice activity.

## Voice boundary

`POST /api/ava/realtime` accepts an SDP offer from an authenticated browser and
creates the OpenAI Realtime call server-side. The standard OpenAI API key never
leaves the server. Realtime function calls are limited to
`request_jarvis_action`; the client forwards those requests to the existing
`/api/jarvis/assistant` route so deterministic permissions and approvals remain
authoritative.

Voice environment overrides are optional:

```text
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_VOICE=marin
```

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run validate:nebula
npm run build
```

Browser QA should cover the default orb home, central-core drill-in, drag and
control click containment, empty-space return, awakening sequence, live event
rail, focused-region card, Recall constellation, desktop layout, and 390x844
mobile layout.
