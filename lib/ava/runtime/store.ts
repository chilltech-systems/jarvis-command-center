import type { AvaRuntimeState, AvaRuntimeUnsubscribe } from "@/lib/ava/runtime/types";

const EMPTY_STATE: AvaRuntimeState = {
  updatedAt: null,
  latestAwareness: null,
  latestTimeline: [],
  latestWorldModel: null,
  latestReasoning: null,
  latestAttention: [],
  latestRecommendations: [],
  latestFocusPlan: null,
  latestExecutiveContext: null,
  latestSnapshot: null,
  previousSnapshot: null,
  latestChanges: [],
  latestVisibleChanges: [],
  latestChangeEvents: [],
  latestRuntimeHealth: null,
  latestObservations: [],
  perceptionStats: {
    total: 0,
    byAdapter: {},
    byType: {},
    lastObservationAt: null,
  },
  perceptionAdapters: [],
};

type StateSubscriber = (state: AvaRuntimeState) => void;

export function createAvaRuntimeStore(initialState: Partial<AvaRuntimeState> = {}) {
  let state: AvaRuntimeState = {
    ...EMPTY_STATE,
    ...initialState,
  };
  const subscribers = new Set<StateSubscriber>();

  function notify() {
    subscribers.forEach((subscriber) => subscriber(state));
  }

  function getState() {
    return state;
  }

  function setPartialState(patch: Partial<AvaRuntimeState>) {
    state = {
      ...state,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    notify();

    return state;
  }

  function reset() {
    state = { ...EMPTY_STATE };
    notify();

    return state;
  }

  function subscribe(subscriber: StateSubscriber): AvaRuntimeUnsubscribe {
    subscribers.add(subscriber);

    return () => {
      subscribers.delete(subscriber);
    };
  }

  return {
    getState,
    setPartialState,
    reset,
    subscribe,
  };
}
