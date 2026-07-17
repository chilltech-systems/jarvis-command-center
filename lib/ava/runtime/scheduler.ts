import type {
  AvaRuntimeJob,
  AvaRuntimeJobContext,
  AvaRuntimeJobInput,
  AvaRuntimeSchedulerSnapshot,
} from "@/lib/ava/runtime/types";

function nextRunAt(intervalMs: number) {
  return new Date(Date.now() + intervalMs).toISOString();
}

function normalizeJob(input: AvaRuntimeJobInput): AvaRuntimeJob {
  return {
    ...input,
    lastRunAt: null,
    nextRunAt: input.enabled ? nextRunAt(input.intervalMs) : null,
    lastDurationMs: null,
    lastError: null,
    running: false,
  };
}

export function createAvaRuntimeScheduler(context: AvaRuntimeJobContext) {
  const jobs = new Map<string, AvaRuntimeJob>();
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  let status: "stopped" | "running" = "stopped";

  async function runJob(jobId: string) {
    const job = jobs.get(jobId);
    if (!job || !job.enabled || job.running) return;
    jobs.set(job.id, { ...job, running: true });

    const startedAt = Date.now();
    const scheduledAt = job.nextRunAt ? new Date(job.nextRunAt).getTime() : startedAt;
    context.health.recordSchedulerLatency(Math.max(0, startedAt - scheduledAt));

    try {
      await job.run(context);
      jobs.set(job.id, {
        ...job,
        lastRunAt: new Date(startedAt).toISOString(),
        nextRunAt: nextRunAt(job.intervalMs),
        lastDurationMs: Date.now() - startedAt,
        lastError: null,
        running: false,
      });
      context.health.reportModuleHealth(`scheduler:${job.id}`, {
        status: "healthy",
        message: `${job.label} completed.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      jobs.set(job.id, {
        ...job,
        lastRunAt: new Date(startedAt).toISOString(),
        nextRunAt: nextRunAt(job.intervalMs),
        lastDurationMs: Date.now() - startedAt,
        lastError: message,
        running: false,
      });
      context.health.reportError(`scheduler:${job.id}`, error);
    }
  }

  function addJob(input: AvaRuntimeJobInput) {
    const job = normalizeJob(input);
    jobs.set(job.id, job);

    if (status === "running" && job.enabled) {
      timers.set(job.id, setInterval(() => {
        void runJob(job.id);
      }, job.intervalMs));
    }

    return job;
  }

  function removeJob(jobId: string) {
    const timer = timers.get(jobId);
    if (timer) clearInterval(timer);
    timers.delete(jobId);

    return jobs.delete(jobId);
  }

  function start() {
    if (status === "running") return getSnapshot();
    status = "running";

    for (const job of jobs.values()) {
      if (!job.enabled) continue;
      jobs.set(job.id, { ...job, nextRunAt: nextRunAt(job.intervalMs) });
      timers.set(job.id, setInterval(() => {
        void runJob(job.id);
      }, job.intervalMs));
    }

    return getSnapshot();
  }

  function stop() {
    timers.forEach((timer) => clearInterval(timer));
    timers.clear();
    status = "stopped";

    return getSnapshot();
  }

  function getSnapshot(): AvaRuntimeSchedulerSnapshot {
    return {
      status,
      jobs: Array.from(jobs.values()).map(({ run, ...job }) => job),
    };
  }

  return {
    addJob,
    removeJob,
    runJob,
    start,
    stop,
    getSnapshot,
  };
}
