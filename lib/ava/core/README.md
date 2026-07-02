# Ava Cognitive Core

The Cognitive Core is Ava's internal intelligence layer. It is intentionally separate from the dashboard UI, API routes, approval execution, and current integration helpers.

Phase 1 is additive only. Existing helpers still power the current dashboard, and the core wraps them so future features can migrate toward a single architecture without breaking today's behavior.

## Information Flow

```text
Integrations
-> Awareness
-> Events
-> Timeline
-> Memory
-> World Model
-> Reasoning
-> Attention
-> Dashboard / Assistant / Voice / Agents
```

Future code should follow this direction. New features should not pull directly from integrations when a Cognitive Core adapter can expose the same signal.

## Modules

- `types.ts` defines the shared event, timeline, memory, world, reasoning, and attention contracts.
- `awareness.ts` wraps existing Ava helpers such as Todoist, completed tasks, weather, projects, Gmail attention, schedule, automations, and connections.
- `events.ts` normalizes awareness outputs into typed `AvaEvent` records.
- `timeline.ts` merges, sorts, filters, groups, summarizes, and prioritizes events with pure functions.
- `memory.ts` provides optional Supabase-backed storage using the existing `jarvis_memory` table.
- `world.ts` converts timeline events into durable real-world entities.
- `reasoning.ts` produces deterministic priorities, risks, changes, approvals, and focus suggestions without OpenAI.
- `attention.ts` scores events into `Critical`, `High`, `Medium`, `Background`, or `Ignore`.
- `state.ts` composes the full cognitive state.
- `snapshot.ts` creates serializable snapshots from cognitive state.
- `diff.ts` compares previous and current snapshots and filters noisy changes.
- `changes.ts` defines the perception change model, change classification, change-to-event conversion, and deterministic summaries.
- `perception.ts` orchestrates snapshot creation, previous-snapshot loading, change detection, latest-snapshot storage, and change summary output.
- `executive-context.ts` combines awareness, snapshots, changes, timeline, world, reasoning, attention, focus, status, recommendations, and page adapters into Ava's right-now operating context.
- `briefing.ts` builds deterministic morning, afternoon, and evening daily briefs from Executive Context.
- `focus.ts` limits Ava's focus output to top priorities, secondary priorities, background items, and future work.
- `status.ts` determines Ava's system status: `Calm`, `Focused`, `Busy`, `Attention Needed`, or `Critical`.
- `recommendations.ts` creates deterministic recommendations without OpenAI.
- `index.ts` exposes the stable public surface for future Ava modules.

## Snapshots

A snapshot is Ava's serializable view of the world at one moment. It includes:

- timestamp
- awareness
- world state
- timeline summary
- reasoning summary
- attention summary

Snapshots are intentionally compact enough to store in the existing `jarvis_memory` table. The latest snapshot uses scope `ava_core_snapshot` and memory key `latest`.

## Differences

The difference engine compares a previous snapshot with the current snapshot. It detects meaningful entity changes such as:

- tasks appearing, disappearing, or completing
- project status changes
- weather condition and meaningful temperature/rain changes
- automation failure or recovery
- risk introduction or clearing
- attention priority increases

The diff engine ignores timestamp-only churn, duplicate changes, tiny weather fluctuations, and insignificant priority movement.

## Perception

Perception answers "what changed?" through deterministic code:

```ts
import { perceiveAvaChanges } from "@/lib/ava/core";

const perception = await perceiveAvaChanges({ supabase, ownerId });
```

The result contains:

- `currentSnapshot`
- `previousSnapshot`
- `detectedChanges`
- `visibleChanges`
- `changeEvents`
- `changeSummary`

No OpenAI calls are used in the perception path.

## Change Events

Changes are first-class perception records. Each change includes:

- id
- timestamp
- type
- category
- severity
- classification
- affected entity
- previous value
- current value
- summary
- recommended action
- confidence
- visibility

`changeToEvent()` converts a change into a normal `AvaEvent` with category `change`, so timelines can merge observation events and change events together through `mergeObservationAndChangeEvents()`.

## Future Notification Flow

Notifications should consume `visibleChanges` and `changeSummary`, not raw helper data. This keeps Ava quieter because the stability filter removes low-value churn before notifications, voice, morning brief, or agent communication see it.

## Executive Context

Executive Context is Ava's primary "right now" object. Dashboard pages should gradually move from direct helper calls to:

```ts
import { getAvaExecutiveContext } from "@/lib/ava/core";

const executiveContext = await getAvaExecutiveContext();
```

It combines:

- awareness
- current snapshot
- recent changes
- merged timeline
- memory-ready state
- reasoning
- attention
- world model
- mission status
- focus plan
- recommendations
- deterministic daily brief

The context exposes user-facing summaries such as `businessSummary`, `personalSummary`, `automationSummary`, `calendarSummary`, `weatherSummary`, `topPriorities`, `activeRisks`, `pendingApprovals`, `recommendedActions`, `dailyBrief`, and `intelligenceFeed`.

## Daily Brief

`buildExecutiveDailyBrief()` creates morning, afternoon, and evening variants from Executive Context. It does not call OpenAI. The brief keeps Ava's first-person background-assistant voice while using cognitive state as its source of truth.

## Focus Engine

`buildFocusPlan()` combines deterministic reasoning priorities with meaningful recent changes. It intentionally limits output:

- top 3 priorities
- secondary priorities
- background items
- future work

Ava should simplify the day rather than surface every available signal.

## Status Engine

`determineAvaStatus()` maps the current operating state into:

- `Calm`
- `Focused`
- `Busy`
- `Attention Needed`
- `Critical`

The status is based on critical events, open risks, pending approvals, and important changes. Future orb animation, dashboard tone, voice tone, and notifications can consume this status.

## Recommendation Engine

`buildRecommendations()` produces deterministic recommendations from risks, approvals, visible changes, and top priorities. Recommendations never execute actions; approval-gated tools remain unchanged.

## Dashboard Migration Strategy

Phase 3 begins the dashboard migration without changing layouts:

- Home now consumes `getAvaExecutiveContext()`.
- `/api/ava/daily-brief` now returns the Executive Context daily brief.
- Intelligence Feed now consumes `getAvaExecutiveContext()`.

Future migration order:

1. Tasks
2. Calendar
3. Projects
4. Automations
5. Settings
6. Assistant bootstrap context

Old helper modules stay in place. The adapter path remains:

```text
Current helper -> Awareness -> Executive Context -> Dashboard
```

## Adding a New Integration

1. Keep the integration-specific read logic in its own helper or service.
2. Add that helper to `buildAvaAwareness()` in `awareness.ts`.
3. Add a normalizer in `events.ts` that maps the helper output to `AvaEvent`.
4. Include those events in `normalizeAwarenessEvents()`.
5. Add entity mapping in `world.ts` only if the default event-to-entity conversion is not enough.
6. Add reasoning or attention rules only when the new signal should change Ava's priorities.

Example: Google Drive should first expose a read-only helper, then normalize documents into `project` or `system` events before any dashboard page consumes them.

## Adding a New Entity

1. Add the entity type to `AvaEntityType` in `types.ts`.
2. Emit events with that `entityType` and a stable `entityId`.
3. Use `relatedEntities` to connect it to people, projects, automations, tasks, or systems.
4. Let `buildWorldModel()` assemble current state, health, priority, relationships, last update, and active alerts.

## Adding a Reasoning Rule

1. Keep the rule deterministic.
2. Use awareness, events, timeline, world model, or attention scores as inputs.
3. Return structured output from `reasoning.ts`.
4. Do not call OpenAI from the Cognitive Core reasoning path.
5. Do not execute external actions from reasoning; create an approval event or recommendation instead.

## Memory Scopes

The core uses the existing `jarvis_memory` table through these scopes:

- `ava_core_event`
- `ava_core_snapshot`
- `ava_core_daily_snapshot`
- `ava_core_change`
- `ava_core_notable_change`
- `dashboard_daily_snapshot`

Memory writes are optional. Pure cognitive state can be built without a Supabase client, which keeps local development and future agents simple.

## Current Migration Boundary

This phase does not change dashboard routes, assistant approvals, n8n workflow contracts, or existing helper return shapes. Future migrations can replace page-level helper calls with `buildAvaCognitiveState()` after the core has been verified in production-shaped local requests.
