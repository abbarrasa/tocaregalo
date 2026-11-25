export const maxClosureDelayMs = 60_000;
export const maxDeliveryAttempts = 6;

export function isClosedAt(closureAtMs: number | null, nowMs: number): boolean {
  return closureAtMs !== null && nowMs >= closureAtMs;
}

export function isClosureOnTime(closureAtMs: number, processedAtMs: number): boolean {
  return processedAtMs >= closureAtMs && processedAtMs - closureAtMs <= maxClosureDelayMs;
}

export function nextDeliveryAt(
  failedAttempts: number,
  failedAtMs: number,
  baseDelayMs: number,
): number | null {
  if (!Number.isSafeInteger(failedAttempts) || failedAttempts < 1 || failedAttempts > maxDeliveryAttempts) {
    throw new RangeError('Invalid number of failed delivery attempts.');
  }
  if (!Number.isSafeInteger(baseDelayMs) || baseDelayMs < 1 || !Number.isSafeInteger(failedAtMs)) {
    throw new RangeError('Invalid delivery retry timing.');
  }
  if (failedAttempts === maxDeliveryAttempts) return null;

  const nextAtMs = failedAtMs + baseDelayMs * 2 ** (failedAttempts - 1);
  if (!Number.isSafeInteger(nextAtMs)) throw new RangeError('Retry timestamp exceeds supported range.');
  return nextAtMs;
}
