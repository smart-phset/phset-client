export interface PollEnvironment {
  visible(): boolean;
  later(callback: () => void, delay: number): unknown;
  cancel(timer: unknown): void;
  onVisibility(callback: () => void): () => void;
}

// Schedule after completion, never setInterval: slow requests cannot overlap.
export function startMonitoringPoll(task: (signal: AbortSignal) => Promise<void>,
  environment: PollEnvironment, delay = 5_000): () => void {
  let stopped = false, running = false;
  let timer: unknown;
  let controller: AbortController | null = null;
  const cancelTimer = () => { if (timer !== undefined) environment.cancel(timer); timer = undefined; };
  async function run() {
    cancelTimer();
    if (stopped || running || !environment.visible()) return;
    running = true;
    controller = new AbortController();
    try { await task(controller.signal); }
    catch { /* The consumer displays individual request failures. */ }
    finally {
      running = false;
      controller = null;
      if (!stopped && environment.visible()) timer = environment.later(() => { void run(); }, delay);
    }
  }
  const unsubscribe = environment.onVisibility(() => {
    cancelTimer();
    if (environment.visible()) void run();
    else controller?.abort();
  });
  void run();
  return () => { stopped = true; cancelTimer(); controller?.abort(); unsubscribe(); };
}
