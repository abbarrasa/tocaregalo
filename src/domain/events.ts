export type GroupEvent = Readonly<{
  id: string; groupId: string; closureAtMs: number | null; createdAtMs: number;
}>;

export type EventCreation = Readonly<{ closureAtMs: number | null }>;

export class EventInputError extends Error {
  constructor() { super('Invalid event input.'); this.name = 'EventInputError'; }
}

export function eventCreationInput(value: unknown): EventCreation {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !('closureAtMs' in value)) {
    throw new EventInputError();
  }
  const closureAtMs = value.closureAtMs;
  if (closureAtMs !== null && (typeof closureAtMs !== 'number' || !Number.isSafeInteger(closureAtMs))) {
    throw new EventInputError();
  }
  return { closureAtMs };
}

export function requireFutureClosure(closureAtMs: number | null, createdAtMs: number): void {
  if (closureAtMs !== null && (!Number.isSafeInteger(closureAtMs) || closureAtMs <= createdAtMs)) {
    throw new EventInputError();
  }
}
