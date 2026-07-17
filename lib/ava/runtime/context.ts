import type { AvaRuntimeContext, AvaRuntimeUnsubscribe } from "@/lib/ava/runtime/types";

type ContextSubscriber = (context: AvaRuntimeContext) => void;

function emptyContext(): AvaRuntimeContext {
  return {
    currentMission: null,
    currentFocus: null,
    activeAlerts: [],
    currentConversation: null,
    activeUser: null,
    currentRoom: null,
    executiveContext: null,
    currentGoals: [],
    runtimeStatus: "shutdown",
    updatedAt: new Date().toISOString(),
  };
}

export function createAvaRuntimeContext(initialContext: Partial<AvaRuntimeContext> = {}) {
  let context: AvaRuntimeContext = {
    ...emptyContext(),
    ...initialContext,
  };
  const subscribers = new Set<ContextSubscriber>();

  function notify() {
    subscribers.forEach((subscriber) => subscriber(context));
  }

  function getContext() {
    return context;
  }

  function setContext(patch: Partial<AvaRuntimeContext>) {
    context = {
      ...context,
      ...patch,
      updatedAt: patch.updatedAt || new Date().toISOString(),
    };
    notify();

    return context;
  }

  function reset() {
    context = emptyContext();
    notify();

    return context;
  }

  function subscribe(subscriber: ContextSubscriber): AvaRuntimeUnsubscribe {
    subscribers.add(subscriber);

    return () => {
      subscribers.delete(subscriber);
    };
  }

  return {
    getContext,
    setContext,
    reset,
    subscribe,
  };
}
