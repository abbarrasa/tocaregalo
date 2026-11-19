export function applicationOrigin(value: string): string | null {
  try {
    const configured = new URL(value);
    return configured.protocol === 'https:' && configured.origin === value ? configured.origin : null;
  } catch { return null; }
}
