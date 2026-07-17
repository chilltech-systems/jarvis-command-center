import type {
  AvaRuntimeSnapshotMetadata,
  AvaRuntimeSnapshotState,
} from "@/lib/ava/runtime/types";
import type { AvaCoreSnapshot } from "@/lib/ava/core/types";

export function createAvaRuntimeSnapshotManager(initialSnapshot: AvaCoreSnapshot | null = null) {
  let state: AvaRuntimeSnapshotState = {
    current: initialSnapshot,
    previous: null,
    metadata: initialSnapshot
      ? {
          generatedAt: initialSnapshot.timestamp,
          replacedAt: new Date().toISOString(),
          changeCount: 0,
          source: "initial",
        }
      : null,
  };

  function getCurrent() {
    return state.current;
  }

  function getPrevious() {
    return state.previous;
  }

  function replace(
    snapshot: AvaCoreSnapshot,
    metadata: Partial<AvaRuntimeSnapshotMetadata> = {},
  ) {
    state = {
      current: snapshot,
      previous: state.current,
      metadata: {
        generatedAt: metadata.generatedAt || snapshot.timestamp,
        replacedAt: metadata.replacedAt || new Date().toISOString(),
        changeCount: metadata.changeCount ?? 0,
        source: metadata.source || "runtime",
      },
    };

    return state;
  }

  function rollback() {
    if (!state.previous) return state;

    state = {
      current: state.previous,
      previous: state.current,
      metadata: {
        generatedAt: state.previous.timestamp,
        replacedAt: new Date().toISOString(),
        changeCount: state.metadata?.changeCount || 0,
        source: "rollback",
      },
    };

    return state;
  }

  function getSnapshotAgeMs() {
    if (!state.current) return null;

    return Date.now() - new Date(state.current.timestamp).getTime();
  }

  function getState() {
    return state;
  }

  return {
    getCurrent,
    getPrevious,
    replace,
    rollback,
    getSnapshotAgeMs,
    getState,
  };
}
