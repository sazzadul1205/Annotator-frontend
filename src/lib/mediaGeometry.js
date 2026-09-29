// src/lib/mediaGeometry.js
// Bounding-box maths for the annotation canvas.
//
// The server stores boxes normalised to 0..1 (`utils/geometry.js` on the
// backend) so a box means the same thing on any image size. The canvas works
// in *display* pixels and converts at the edges; nothing in between is
// normalised. Keeping one coordinate space per layer is what stops a box
// drifting every time the viewport is resized.

/** Clamp to a range. */
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Normalises a box the same way the server does, so what the canvas shows is
 * what will be stored: the left edge is clamped first, and the width is then
 * re-capped to `1 - left` so the far edge stays on the canvas.
 */
export function normalizeBox(box) {
  const x = clamp(box.x, 0, 1);
  const y = clamp(box.y, 0, 1);
  const width = clamp(box.width, 0, 1 - x);
  const height = clamp(box.height, 0, 1 - y);
  return { x, y, width, height };
}

/** Normalised -> display pixels, given the natural size of the media. */
export function normalizedToDisplay(box, natural) {
  return {
    x: box.x * natural.width,
    y: box.y * natural.height,
    width: box.width * natural.width,
    height: box.height * natural.height,
  };
}

/** Display pixels -> normalised. Rounds to 5dp to keep the payload tidy. */
export function displayToNormalized(box, natural) {
  const r = (n) => Math.round(n * 1e5) / 1e5;
  return normalizeBox({
    x: r(box.x / natural.width),
    y: r(box.y / natural.height),
    width: r(box.width / natural.width),
    height: r(box.height / natural.height),
  });
}

/** A box that covers a sub-pixel selection is not worth sending. */
export const isDegenerate = (box, minPixels = 2) =>
  box.width < minPixels || box.height < minPixels;

/** YOLO form, for the preview shown before saving. */
export function toYolo(box, classIndex) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return `${classIndex} ${round(cx)} ${round(cy)} ${round(box.width)} ${round(box.height)}`;
}

const round = (n) => Math.round(n * 1e4) / 1e4;

/* ------------------------------------------------------------------ */
/* Resize handles                                                      */
/* ------------------------------------------------------------------ */

/**
 * The eight resize grips, in the order the cursor icons cycle through them:
 * nw, n, ne, e, se, s, sw, w.
 */
export const HANDLES = [
  { id: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

/** Which edges a handle moves. Derived from the handle id, not hard-coded. */
export function handleEdges(id) {
  return {
    left: id.includes("w"),
    right: id.includes("e"),
    top: id.startsWith("n"),
    bottom: id.startsWith("s"),
  };
}

/**
 * Applies a drag to one handle.
 *
 * Works entirely in display pixels and lets the box go negative or past the
 * edge while dragging — a half-finished drag that jumps back to the canvas
 * feels broken. `displayToNormalized` clamps once, on release.
 */
export function resizeBox(box, handleId, dx, dy) {
  const edges = handleEdges(handleId);
  let { x, y, width, height } = box;

  if (edges.left) {
    const right = x + width;
    x = Math.min(x + dx, right - 1); // keep at least 1px of width
    width = right - x;
  }
  if (edges.right) {
    width = Math.max(1, width + dx);
  }
  if (edges.top) {
    const bottom = y + height;
    y = Math.min(y + dy, bottom - 1);
    height = bottom - y;
  }
  if (edges.bottom) {
    height = Math.max(1, height + dy);
  }

  return { x, y, width, height };
}

/* ------------------------------------------------------------------ */
/* Label colours                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fallback colour for a label the server did not assign one to.
 *
 * The colour is derived from the slug so the same class is always the same
 * hue: a box keeps its identity across sessions even if the label set never
 * carried a colour.
 */
export function colorForLabel(value) {
  let hash = 0;
  const s = String(value || "");
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 55%)`;
}

/** The label's own colour if it has a usable one, otherwise the derived hue. */
export const labelColor = (label) =>
  (label?.color && label.color.startsWith("#") ? label.color : null) ||
  colorForLabel(label?.value);
