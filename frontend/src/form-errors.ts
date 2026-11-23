export type FormFieldErrors = Readonly<Record<string, string>>;

export function firstFieldError(fields: FormFieldErrors): { field: string; message: string } | null {
  const entry = Object.entries(fields).find(([, message]) => message);
  return entry ? { field: entry[0], message: entry[1] } : null;
}

export function fieldError(fields: FormFieldErrors, field: string): string {
  return fields[field] ?? '';
}
