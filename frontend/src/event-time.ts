export function formatEventTime(ms: number): string {
  const value = new Date(ms);
  return Number.isNaN(value.getTime()) ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

// Round-trip local components: Date otherwise normalizes invalid dates and DST gaps.
export function localClosureTime(value: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!parts) return null;
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const date = new Date(value);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day
    || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  const ms = date.getTime(); return Number.isSafeInteger(ms) ? ms : null;
}
