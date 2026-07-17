import type { AvaRuntimeLifecycleStage, AvaRuntimeUnsubscribe } from "@/lib/ava/runtime/types";

type LifecycleHandler = (stage: AvaRuntimeLifecycleStage) => void | Promise<void>;

export function createAvaRuntimeLifecycle(initialStage: AvaRuntimeLifecycleStage = "shutdown") {
  let stage = initialStage;
  const handlers = new Set<LifecycleHandler>();

  async function transition(nextStage: AvaRuntimeLifecycleStage) {
    stage = nextStage;
    await Promise.all(Array.from(handlers).map((handler) => handler(stage)));

    return stage;
  }

  function onChange(handler: LifecycleHandler): AvaRuntimeUnsubscribe {
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  return {
    getStage: () => stage,
    transition,
    onChange,
  };
}
