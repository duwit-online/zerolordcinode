// Jellyfin-only architecture. External embed providers have been removed.
export const PLAYBACK_SOURCE_LABELS: Record<string, string> = {
  jellyfin: "Jellyfin",
  override: "Admin Override",
};
export const PLAYBACK_SOURCE_KEYS = Object.keys(PLAYBACK_SOURCE_LABELS);
export const DEFAULT_PLAYBACK_ORDER = [...PLAYBACK_SOURCE_KEYS];
export function normalizePlaybackOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_PLAYBACK_ORDER;
  const filtered = value.filter(
    (k): k is string => typeof k === "string" && PLAYBACK_SOURCE_KEYS.includes(k),
  );
  return filtered.length ? filtered : DEFAULT_PLAYBACK_ORDER;
}
