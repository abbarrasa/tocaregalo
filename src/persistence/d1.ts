// Structural subset of the Workers D1 API; no runtime dependency is needed.
export type D1Value = string | number | null | ArrayBuffer | Uint8Array;
export interface D1Statement {
  bind(...values: D1Value[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface PersistenceDatabase {
  prepare(sql: string): D1Statement;
  // D1 executes a batch transactionally, rolling back on any failing statement.
  batch(statements: D1Statement[]): Promise<readonly { success: boolean; results: unknown[] }[]>;
}
