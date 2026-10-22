import type { Query } from './types.ts';

export function toSearchParams(query?: Query) {
  if (query === undefined || query === null) {return new URLSearchParams();}
  if (typeof query === 'string' || query instanceof URLSearchParams) {return new URLSearchParams(query);}
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
}
