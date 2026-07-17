# Ava Second-Brain Core Expansion

## Runtime Modes

`request` mode is the production-safe default. It performs one complete cognition cycle without starting timers, polling, WebSockets, or background schedulers. `continuous` mode remains available for local development and a future durable worker.

Every cognition cycle collects awareness once. Cognitive State, Executive Context, snapshots, changes, focus, recommendations, and memory persistence all derive from that shared state.

## Source Integrity

Awareness sources report status and freshness. Only `live` sources normalize into Cognitive Core events. Mock, fallback, unavailable, and placeholder data can still support interface fallbacks, but cannot influence priorities, risks, mission status, or change detection.

## Structured Memory

The expansion reuses `jarvis_memory`; no migration is required. Stable `(owner_id, scope, memory_key)` upserts suppress duplicates.

Memory records include provenance, observation and validity times, confidence, status, related entities, sensitivity, conflict state, evidence count, and supersession history. Request cognition persists only initial state or meaningful user-visible changes.

Adaptive learning activates only when:

- confidence is at least `0.90`
- two independent signals support the inference
- the memory is not sensitive
- the evidence is not conflicting

All other inferences remain reviewable.

## Canonical Entities

Canonical entities preserve source identifiers and explicit aliases. Exact source identity or one unambiguous explicit alias can resolve an entity. Multiple alias matches create an identity candidate instead of an automatic merge.

Typed relationship records connect canonical entities without changing existing Ava event contracts. The World Model exposes an additive `canonicalId` while retaining its established entity IDs.

## Validation

```bash
npm run validate:second-brain
npm run lint
npm run validate
npm run build
```

The dedicated validation covers single-pass awareness, mock exclusion, request timer safety, lifecycle recovery, scheduler overlap, strict learning promotion, memory deduplication, meaningful-change persistence, exact identity resolution, aliases, and ambiguous identity candidates.
