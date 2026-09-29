// src/lib/format.js
// Small display formatters shared across the media pages.

/**
 * Bytes as a human-readable size.
 *
 * Media datasets can hold gigabytes of video, and the raw byte count from the
 * API is unreadable in a card footer.
 */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** "1 asset" / "3 assets" — avoids a pluralisation bug in every call site. */
export function formatCount(n, singular, plural) {
  const count = Number(n) || 0;
  const word = count === 1 ? singular : plural || `${singular}s`;
  return `${count.toLocaleString()} ${word}`;
}

/** Milliseconds as m:ss, or h:mm:ss for anything over an hour. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A frame position for display: "1:23.40" plus the millisecond offset. */
export function formatTimestamp(ms) {
  const total = Math.max(0, Number(ms) || 0);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Fractional class balance as a percentage, for the stats panel. */
export const formatPercent = (ratio) => `${Math.round((Number(ratio) || 0) * 100)}%`;
