import { pageInput, PaginationInputError, type PageInput } from './pagination.ts';

export type GroupEvent = Readonly<{
  id: string; groupId: string; closureAtMs: number | null; createdAtMs: number;
}>;

export type EventCreation = Readonly<{ closureAtMs: number | null }>;

export class EventInputError extends Error {
  constructor() { super('Invalid event input.'); this.name = 'EventInputError'; }
}

export type EventCursor = Readonly<{ createdAtMs: number; id: string }>;
export type EventPageInput = Readonly<{ limit: number; cursor: EventCursor | null }>;

export function eventCursor(event: EventCursor): string {
  return JSON.stringify([1, event.createdAtMs, event.id]);
}

export function eventPageInput(limit: string | null, cursor: string | null): EventPageInput {
  let page: PageInput;
  try { page = pageInput(limit, cursor); }
  catch (error) {
    if (error instanceof PaginationInputError) throw new EventInputError();
    throw error;
  }
  if (page.cursor === null) return { limit: page.limit, cursor: null };
  let value: unknown;
  try { value = JSON.parse(page.cursor); }
  catch (error) {
    if (error instanceof SyntaxError) throw new EventInputError();
    throw error;
  }
  if (!Array.isArray(value) || value.length !== 3 || value[0] !== 1
    || typeof value[1] !== 'number' || !Number.isSafeInteger(value[1])
    || typeof value[2] !== 'string' || !value[2].trim()) throw new EventInputError();
  return { limit: page.limit, cursor: { createdAtMs: value[1], id: value[2] } };
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
