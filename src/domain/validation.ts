export function requireId(id: string): void {
  if (!id.trim()) throw new RangeError('An ID is required.');
}

export function requireTimestamp(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError('Invalid timestamp.');
}

export function normalizedName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 100) throw new RangeError('Invalid name.');
  return name;
}
