/** Normaliza hostnames DNS para comparación (RFC 1035). */
export function normalizeDnsHostname(value: string): string {
  return value.trim().replace(/\.$/, '').toLowerCase();
}

/** Normaliza TXT para comparación (quita comillas/espacios, minúsculas). */
export function normalizeDnsTxt(value: string): string {
  return value
    .replace(/^"|"$/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/** Une todos los fragmentos TXT (varios RR o strings RFC en un RR). */
export function joinTxtRecords(records: string[]): string {
  return records.map(normalizeDnsTxt).join('');
}
