export type PageInput = Readonly<{ limit: number; cursor: string | null }>;

export class PaginationInputError extends Error {
  constructor() { super('Invalid pagination input.'); this.name = 'PaginationInputError'; }
}

export function pageInput(limit: string | null, cursor: string | null): PageInput {
  if (limit !== null && !/^[1-9][0-9]?$/.test(limit)) throw new PaginationInputError();
  const size = limit === null ? 20 : Number(limit);
  if (size > 50 || (cursor !== null && (!cursor.trim() || cursor.length > 512))) throw new PaginationInputError();
  return { limit: size, cursor };
}
