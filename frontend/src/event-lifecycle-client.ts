import { ApiError, isRecord, readJson, type HttpClient } from './http-client.ts';

export type EventState = Readonly<{ eventId: string; status: 'pending' | 'ready' | 'closed'; drawId: string | null; closedAtMs: number | null }>;
export interface EventLifecycleClient {
  state(eventId: string): Promise<EventState>;
  draw(eventId: string): Promise<EventState>;
  close(eventId: string): Promise<EventState>;
}
function state(value: unknown, eventId: string): EventState {
  if (!isRecord(value) || !isRecord(value.event)) throw new ApiError(502);
  const event = value.event;
  if (event.eventId !== eventId || !['pending', 'ready', 'closed'].includes(String(event.status))
    || !(event.drawId === null || (typeof event.drawId === 'string' && !!event.drawId.trim()))
    || !(event.closedAtMs === null || (typeof event.closedAtMs === 'number' && Number.isSafeInteger(event.closedAtMs)))) throw new ApiError(502);
  if (event.status === 'pending' && event.drawId === null && event.closedAtMs === null) return { eventId, status: 'pending', drawId: null, closedAtMs: null };
  if (event.status === 'ready' && typeof event.drawId === 'string' && event.closedAtMs === null) return { eventId, status: 'ready', drawId: event.drawId, closedAtMs: null };
  if (event.status === 'closed' && typeof event.drawId === 'string' && typeof event.closedAtMs === 'number') return { eventId, status: 'closed', drawId: event.drawId, closedAtMs: event.closedAtMs };
  throw new ApiError(502);
}
export function eventLifecycleClientFor(http: HttpClient): EventLifecycleClient {
  const path = (id: string, operation: 'draw' | 'close') => '/api/events/' + encodeURIComponent(id) + '/' + operation;
  async function mutate(id: string, operation: 'draw' | 'close'): Promise<EventState> {
    const result = state(await readJson(await http.request(path(id, operation), undefined, true, 'POST')), id);
    if (result.status !== (operation === 'close' ? 'closed' : 'ready')) throw new ApiError(502);
    return result;
  }
  return {
    async state(id) { return state(await readJson(await http.request(path(id, 'draw'))), id); },
    draw(id) { return mutate(id, 'draw'); },
    close(id) { return mutate(id, 'close'); },
  };
}
