import { ApiError, isRecord } from './http-client.ts';

export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export const pageSize = 20;
export function pageQuery(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor !== null) params.set('cursor', cursor);
  return '?' + params.toString();
}
export function parsePage<T>(value: unknown, key: string, parse: (value: unknown) => T, previous: string | null): Page<T> {
  if (!isRecord(value)) throw new ApiError(502);
  const rows = value[key]; const cursor = value.nextCursor;
  if (!Array.isArray(rows) || rows.length > pageSize
    || !(cursor === null || (typeof cursor === 'string' && !!cursor.trim() && cursor.length <= 512 && cursor !== previous))
    || (rows.length === 0 && cursor !== null)) throw new ApiError(502);
  return { items: rows.map(parse), nextCursor: cursor };
}
