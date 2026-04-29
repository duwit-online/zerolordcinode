// Native-only offline downloads using Capacitor Filesystem.
// Stores progress + metadata in localStorage; binary in Documents/cinode-downloads/.
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { isNative } from "./native";

const META_KEY = "cinode_offline_meta_v1";
const FOLDER = "cinode-downloads";

export interface OfflineMeta {
  id: string;                // tmdb_<type>_<id>[_s_e]
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  posterPath?: string | null;
  fileName: string;          // file in Documents/cinode-downloads/
  mime: string;
  bytes: number;
  addedAt: string;
  sourceLabel: string;
}

export function makeId(tmdbId: number, type: string, season?: number, episode?: number) {
  return type === "tv" ? `tmdb_tv_${tmdbId}_s${season ?? 1}e${episode ?? 1}` : `tmdb_movie_${tmdbId}`;
}

export function listOffline(): OfflineMeta[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "[]"); } catch { return []; }
}
function writeAll(rows: OfflineMeta[]) {
  localStorage.setItem(META_KEY, JSON.stringify(rows));
}
export function getOffline(id: string) { return listOffline().find((r) => r.id === id); }

export async function deleteOffline(id: string) {
  const meta = getOffline(id);
  if (meta && isNative()) {
    try { await Filesystem.deleteFile({ path: `${FOLDER}/${meta.fileName}`, directory: Directory.Documents }); } catch {}
  }
  writeAll(listOffline().filter((r) => r.id !== id));
}

export async function getOfflineSrc(id: string): Promise<string | null> {
  const meta = getOffline(id);
  if (!meta || !isNative()) return null;
  try {
    const r = await Filesystem.getUri({ path: `${FOLDER}/${meta.fileName}`, directory: Directory.Documents });
    const cap = (window as any).Capacitor;
    return cap?.convertFileSrc ? cap.convertFileSrc(r.uri) : r.uri;
  } catch { return null; }
}

interface DownloadArgs {
  id: string;
  url: string;
  title: string;
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  posterPath?: string | null;
  sourceLabel: string;
  onProgress?: (pct: number, loaded: number, total: number) => void;
}

// Streams the URL and writes to filesystem in chunks.
export async function downloadOffline(args: DownloadArgs): Promise<OfflineMeta> {
  if (!isNative()) throw new Error("Offline downloads are only available in the mobile app.");
  const res = await fetch(args.url);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  const total = Number(res.headers.get("content-length") || 0);
  const ct = res.headers.get("content-type") || "video/mp4";
  const ext = ct.includes("mpegurl") ? "m3u8" : ct.includes("webm") ? "webm" : ct.includes("matroska") ? "mkv" : "mp4";
  const fileName = `${args.id}.${ext}`;

  try { await Filesystem.mkdir({ path: FOLDER, directory: Directory.Documents, recursive: true }); } catch {}
  // Start empty file
  await Filesystem.writeFile({ path: `${FOLDER}/${fileName}`, directory: Directory.Documents, data: "", encoding: Encoding.UTF8 });

  const reader = res.body.getReader();
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const b64 = bufferToBase64(value);
    await Filesystem.appendFile({ path: `${FOLDER}/${fileName}`, directory: Directory.Documents, data: b64 });
    loaded += value.byteLength;
    if (total) args.onProgress?.(Math.round((loaded / total) * 100), loaded, total);
    else args.onProgress?.(0, loaded, 0);
  }

  const meta: OfflineMeta = {
    id: args.id, tmdbId: args.tmdbId, type: args.type, season: args.season, episode: args.episode,
    title: args.title, posterPath: args.posterPath, fileName, mime: ct, bytes: loaded,
    addedAt: new Date().toISOString(), sourceLabel: args.sourceLabel,
  };
  const all = listOffline().filter((r) => r.id !== meta.id);
  all.unshift(meta);
  writeAll(all);
  return meta;
}

function bufferToBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(bin);
}
