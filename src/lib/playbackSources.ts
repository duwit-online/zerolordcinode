export const PLAYBACK_SOURCE_LABELS: Record<string, string> = {
  jellyfin_direct: "Jellyfin Direct",
  jellyfin_hls: "Jellyfin HLS Proxy",
  override: "Admin Override",
  vidsrc_xyz: "VidSrc XYZ",
  "2embed": "2Embed",
  superembed: "SuperEmbed",
  vidlink: "VidLink",
  smashy: "Smashy",
};

export const PLAYBACK_SOURCE_KEYS = Object.keys(PLAYBACK_SOURCE_LABELS);

export const DEFAULT_PLAYBACK_ORDER = [...PLAYBACK_SOURCE_KEYS];

export function normalizePlaybackOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_PLAYBACK_ORDER;

  const filtered = value.filter(
    (key): key is string => typeof key === "string" && PLAYBACK_SOURCE_KEYS.includes(key),
  );

  return filtered.length > 0 ? filtered : DEFAULT_PLAYBACK_ORDER;
}