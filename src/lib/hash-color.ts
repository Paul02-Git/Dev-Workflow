/** Deterministic pick from a palette based on a string key — the same key always yields the same entry. */
export function hashPick<T>(key: string, options: T[]): T {
  const normalized = key.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}
