import { recoverExpiredStock } from './recovery';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Starts the stock recovery background check worker.
 */
export function startStockRecoveryWorker(intervalMs: number = 5000): void {
  if (intervalId) {
    console.warn('[WORKER] Stock recovery worker is already running.');
    return;
  }

  console.log(`[WORKER] Starting stock recovery worker. Running every ${intervalMs / 1000} seconds.`);

  const runWorker = async () => {
    // Prevent overlapping executions if one run takes longer than the interval
    if (isRunning) {
      console.warn('[WORKER] Previous stock recovery execution is still running. Skipping this interval.');
      return;
    }

    isRunning = true;
    try {
      await recoverExpiredStock();
    } catch (error: any) {
      console.error('[WORKER] Error occurred during background stock recovery:', error.message);
    } finally {
      isRunning = false;
    }
  };

  // Run immediately on start, then set interval
  runWorker();
  intervalId = setInterval(runWorker, intervalMs);
}

/**
 * Stops the stock recovery background check worker.
 */
export function stopStockRecoveryWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[WORKER] Stock recovery worker stopped.');
  }
}
