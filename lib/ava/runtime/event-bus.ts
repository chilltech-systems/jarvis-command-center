import type {
  AvaRuntimeEvent,
  AvaRuntimeEventHandler,
  AvaRuntimeEventInput,
  AvaRuntimeEventMiddleware,
  AvaRuntimeEventPriority,
  AvaRuntimeUnsubscribe,
} from "@/lib/ava/runtime/types";
import type { AvaCoreJson } from "@/lib/ava/core/types";

const PRIORITY_WEIGHT: Record<AvaRuntimeEventPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

type Subscription = {
  type: string;
  handler: AvaRuntimeEventHandler;
  once: boolean;
};

function createRuntimeEvent<TPayload extends AvaCoreJson = AvaCoreJson>(
  input: AvaRuntimeEventInput<TPayload>,
): AvaRuntimeEvent<TPayload> {
  const timestamp = input.timestamp || new Date().toISOString();

  return {
    id: input.id || `${input.source || "runtime"}:${input.type}:${timestamp}`,
    type: input.type,
    priority: input.priority || "normal",
    timestamp,
    source: input.source || "ava-runtime",
    origin: input.origin || "runtime",
    payload: input.payload ?? ({} as TPayload),
  };
}

export function createAvaRuntimeEventBus() {
  const subscriptions = new Map<string, Subscription>();
  const middleware: AvaRuntimeEventMiddleware[] = [];
  const history: AvaRuntimeEvent[] = [];
  let sequence = 0;

  function subscribe<TPayload extends AvaCoreJson = AvaCoreJson>(
    type: string,
    handler: AvaRuntimeEventHandler<TPayload>,
  ): AvaRuntimeUnsubscribe {
    const id = `subscription:${++sequence}`;
    subscriptions.set(id, { type, handler: handler as AvaRuntimeEventHandler, once: false });

    return () => {
      subscriptions.delete(id);
    };
  }

  function once<TPayload extends AvaCoreJson = AvaCoreJson>(
    type: string,
    handler: AvaRuntimeEventHandler<TPayload>,
  ): AvaRuntimeUnsubscribe {
    const id = `subscription:${++sequence}`;
    subscriptions.set(id, { type, handler: handler as AvaRuntimeEventHandler, once: true });

    return () => {
      subscriptions.delete(id);
    };
  }

  function use(nextMiddleware: AvaRuntimeEventMiddleware): AvaRuntimeUnsubscribe {
    middleware.push(nextMiddleware);

    return () => {
      const index = middleware.indexOf(nextMiddleware);
      if (index >= 0) middleware.splice(index, 1);
    };
  }

  async function dispatch(event: AvaRuntimeEvent) {
    const matchingSubscriptions = Array.from(subscriptions.entries())
      .filter(([, subscription]) => subscription.type === event.type || subscription.type === "*")
      .sort(([, left], [, right]) => {
        if (left.type === right.type) return 0;
        if (left.type === event.type) return -1;
        if (right.type === event.type) return 1;
        return 0;
      });

    await Promise.all(matchingSubscriptions.map(async ([id, subscription]) => {
      await subscription.handler(event);
      if (subscription.once) subscriptions.delete(id);
    }));
  }

  async function publish<TPayload extends AvaCoreJson = AvaCoreJson>(
    input: AvaRuntimeEventInput<TPayload>,
  ): Promise<AvaRuntimeEvent<TPayload>> {
    const event = createRuntimeEvent(input);
    const chain = middleware.reduceRight<(nextEvent: AvaRuntimeEvent) => Promise<void>>(
      (next, current) => async (nextEvent: AvaRuntimeEvent) => {
        await current(nextEvent, next);
      },
      dispatch,
    );

    await chain(event);
    history.unshift(event);
    if (history.length > 100) history.pop();

    return event;
  }

  return {
    publish,
    subscribe,
    once,
    use,
    priorityWeight: (priority: AvaRuntimeEventPriority) => PRIORITY_WEIGHT[priority],
    getSubscriptionCount: () => subscriptions.size,
    getRecentEvents: (limit = 20) => history.slice(0, limit),
  };
}
