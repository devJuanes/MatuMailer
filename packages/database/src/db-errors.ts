export function isMissingTableError(error: unknown, table?: string): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const lower = msg.toLowerCase();
  if (!lower.includes('does not exist') && !lower.includes('no existe')) return false;
  if (!table) return true;
  return lower.includes(table.toLowerCase());
}
