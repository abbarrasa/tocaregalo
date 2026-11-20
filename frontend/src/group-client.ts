import { ApiError, isRecord, readJson, type HttpClient } from './http-client.ts';

export type Group = Readonly<{ id: string; name: string; ownerAccountId: string; createdAtMs: number }>;
export type Member = Readonly<{ accountId: string; displayName: string; joinedAtMs: number; isOwner: boolean }>;
export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export interface GroupClient {
  list(cursor: string | null): Promise<Page<Group>>;
  create(name: string): Promise<Group>;
  find(id: string): Promise<Group>;
  members(id: string, cursor: string | null): Promise<Page<Member>>;
}
const pageSize = 20;
function group(value: unknown): Group {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.name !== 'string' || !value.name.trim() || typeof value.ownerAccountId !== 'string'
    || !value.ownerAccountId.trim() || typeof value.createdAtMs !== 'number' || !Number.isSafeInteger(value.createdAtMs)) throw new ApiError(502);
  return { id: value.id, name: value.name, ownerAccountId: value.ownerAccountId, createdAtMs: value.createdAtMs };
}
function member(value: unknown): Member {
  if (!isRecord(value) || typeof value.accountId !== 'string' || !value.accountId.trim()
    || typeof value.displayName !== 'string' || !value.displayName.trim() || typeof value.isOwner !== 'boolean'
    || typeof value.joinedAtMs !== 'number' || !Number.isSafeInteger(value.joinedAtMs)) throw new ApiError(502);
  return { accountId: value.accountId, displayName: value.displayName, joinedAtMs: value.joinedAtMs, isOwner: value.isOwner };
}
function query(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor !== null) params.set('cursor', cursor);
  return '?' + params.toString();
}
function page<T>(value: unknown, key: string, parse: (value: unknown) => T, previous: string | null): Page<T> {
  if (!isRecord(value)) throw new ApiError(502);
  const rows = value[key]; const cursor = value.nextCursor;
  if (!Array.isArray(rows) || rows.length > pageSize
    || !(cursor === null || (typeof cursor === 'string' && !!cursor.trim() && cursor.length <= 512 && cursor !== previous))
    || (rows.length === 0 && cursor !== null)) throw new ApiError(502);
  return { items: rows.map(parse), nextCursor: cursor };
}
function groupId(id: string): string { return '/api/groups/' + encodeURIComponent(id); }
export function groupClientFor(http: HttpClient): GroupClient {
  return {
    async list(cursor) { return page(await readJson(await http.request('/api/groups' + query(cursor))), 'groups', group, cursor); },
    async create(name) {
      const value = await readJson(await http.request('/api/groups', { name }, true));
      if (!isRecord(value)) throw new ApiError(502); return group(value.group);
    },
    async find(id) {
      const value = await readJson(await http.request(groupId(id)));
      if (!isRecord(value)) throw new ApiError(502); return group(value.group);
    },
    async members(id, cursor) { return page(await readJson(await http.request(groupId(id) + '/members' + query(cursor))), 'members', member, cursor); },
  };
}
