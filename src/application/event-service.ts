import { eventCursor, requireFutureClosure, type EventCreation, type GroupEvent, type EventCursor, type EventPageInput } from '../domain/events.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface EventStore {
  createEvent(actorAccountId: string, event: GroupEvent): Promise<void>;
  findEventForAccount(eventId: string, actorAccountId: string): Promise<GroupEvent | null>;
  listEventsForAccount(groupId: string, actorAccountId: string, limit: number, cursor: EventCursor | null): Promise<GroupEvent[] | null>;
}

export class EventService {
  private readonly store: EventStore;
  private readonly now: () => number;
  constructor(store: EventStore, now = Date.now) { this.store = store; this.now = now; }

  async create(actorAccountId: string, groupId: string, input: EventCreation): Promise<GroupEvent> {
    const createdAtMs = this.now();
    requireTimestamp(createdAtMs);
    requireFutureClosure(input.closureAtMs, createdAtMs);
    const event = { id: crypto.randomUUID(), groupId, closureAtMs: input.closureAtMs, createdAtMs };
    // Repository SQL checks ownership during insertion, without a separate authorization lookup.
    await this.store.createEvent(actorAccountId, event);
    return event;
  }

  async find(actorAccountId: string, eventId: string): Promise<GroupEvent | null> {
    return this.store.findEventForAccount(eventId, actorAccountId);
  }

  async list(actorAccountId: string, groupId: string, page: EventPageInput) {
    const rows = await this.store.listEventsForAccount(groupId, actorAccountId, page.limit + 1, page.cursor);
    if (rows === null) return null;
    const events = rows.slice(0, page.limit);
    return { events, nextCursor: rows.length > page.limit ? eventCursor(events[events.length - 1]) : null };
  }
}
