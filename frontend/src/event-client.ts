import { ApiError, isRecord, readJson, type HttpClient } from './http-client.ts';
import { pageQuery, parsePage, type Page } from './pagination.ts';

export type GroupEvent = Readonly<{ id: string; groupId: string; createdAtMs: number; closureAtMs: number | null }>;
export interface EventClient {
  list(groupId: string, cursor: string | null): Promise<Page<GroupEvent>>;
  create(groupId: string, closureAtMs: number | null): Promise<GroupEvent>;
  find(id: string): Promise<GroupEvent>;
}
function event(value: unknown): GroupEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.groupId !== 'string' || !value.groupId.trim()
    || typeof value.createdAtMs !== 'number' || !Number.isSafeInteger(value.createdAtMs)
    || !(value.closureAtMs === null || (typeof value.closureAtMs === 'number' && Number.isSafeInteger(value.closureAtMs)))) throw new ApiError(502);
  return { id: value.id, groupId: value.groupId, createdAtMs: value.createdAtMs, closureAtMs: value.closureAtMs };
}
function groupEvent(value: unknown, groupId: string): GroupEvent {
  const parsed = event(value); if (parsed.groupId !== groupId) throw new ApiError(502); return parsed;
}
function collection(groupId: string) { return '/api/groups/' + encodeURIComponent(groupId) + '/events'; }
export function eventClientFor(http: HttpClient): EventClient {
  return {
    async list(groupId, cursor) {
      return parsePage(await readJson(await http.request(collection(groupId) + pageQuery(cursor))), 'events', value => groupEvent(value, groupId), cursor);
    },
    async create(groupId, closureAtMs) {
      const value = await readJson(await http.request(collection(groupId), { closureAtMs }, true));
      if (!isRecord(value)) throw new ApiError(502); return groupEvent(value.event, groupId);
    },
    async find(id) {
      const value = await readJson(await http.request('/api/events/' + encodeURIComponent(id)));
      if (!isRecord(value)) throw new ApiError(502);
      const parsed = event(value.event); if (parsed.id !== id) throw new ApiError(502); return parsed;
    },
  };
}
