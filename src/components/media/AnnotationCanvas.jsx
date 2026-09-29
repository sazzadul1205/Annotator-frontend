// src/components/media/AnnotationCanvas.jsx
// The drawing surface for bounding boxes: create, move, resize, delete, and
// pan/zoom. Works identically over an <img> and over a <video>, because the
// overlay is a sibling of the media element rather than something drawn into
// it.
//
// Two coordinate spaces, deliberately:
//
//   image space  — natural pixels of the media (1..width). Boxes live here.
//   screen space — CSS pixels of the stage. The media is scaled and panned by
//                  a CSS transform between the two.
//
// Pan and zoom therefore never touch box data: a transform is applied, and the
// boxes move with the image for free. Converting only on pointer events keeps
// a box from drifting when the window is resized or zoomed.

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  clamp,
  displayToNormalized,
  HANDLES,
  isDegenerate,
  normalizedToDisplay,
  resizeBox,
} from "../../lib/mediaGeometry";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;
const HANDLE_HIT = 10; // px of pointer tolerance around a resize grip

/**
 * @param {object}   props
 * @param {{width:number,height:number}} props.natural  natural media size
 * @param {ReactNode} props.children                     the <img>/<video>,
 *                                                      rendered inside the
 *                                                      pan/zoom transform
 * @param {Array}    props.annotations                 annotation DTOs
 * @param {string|null} props.selectedId
 * @param {"select"|"draw"|"pan"} props.tool
 * @param {Function} props.onSelect
 * @param {Function} props.onCreate    receives a normalised box
 * @param {Function} props.onUpdate    receives (id, normalised box)
 * @param {Function} props.onDelete    receives (id)
 * @param {Function} props.colorFor    (annotation) => css colour
 */
export default function AnnotationCanvas({
  natural,
  children,
  annotations,
  selectedId,
  tool,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  colorFor,
}) {
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [fitted, setFitted] = useState(false);
  // Pan is state, not a ref read during render, so the cursor can reflect it.
  const [panning, setPanning] = useState(false);

  // The in-flight gesture. Kept in a ref rather than state: pointermove fires
  // far more often than React can usefully re-render, and a ref lets the move
  // handler read the drag origin without a stale closure.
  const dragRef = useRef(null);
  const [draft, setDraft] = useState(null);

  /* ---------------------------------------------------------------- */
  /* Fit to view                                                       */
  /* ---------------------------------------------------------------- */

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !natural?.width) return;
    const rect = stage.getBoundingClientRect();
    const pad = 24;
    const zoom = Math.min(
      (rect.width - pad) / natural.width,
      (rect.height - pad) / natural.height,
    );
    const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    setView({
      zoom: z,
      x: (rect.width - natural.width * z) / 2,
      y: (rect.height - natural.height * z) / 2,
    });
  }, [natural]);

  // Fit once the media reports its size, and again on resize until the user
  // takes manual control of the view.
  useEffect(() => {
    if (!natural?.width) return;
    if (fitted) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 10) return;
    setFitted(true);
    fit();
  }, [natural, fitted, fit]);

  useEffect(() => {
    const onResize = () => {
      if (fitted) fit();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitted, fit]);

  /* ---------------------------------------------------------------- */
  /* Coordinate conversion                                             */
  /* ---------------------------------------------------------------- */

  const toImage = useCallback(
    (clientX, clientY) => {
      const rect = stageRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.x) / view.zoom,
        y: (clientY - rect.top - view.y) / view.zoom,
      };
    },
    [view],
  );

  /* ---------------------------------------------------------------- */
  /* Zoom                                                              */
  /* ---------------------------------------------------------------- */

  // Registered manually so preventDefault works — React's onWheel is passive.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      setView((v) => {
        // Trackpad pinch arrives as ctrlKey; a mouse wheel does not. Both zoom
        // here because the workspace never needs to page-scroll.
        const factor = e.ctrlKey ? 0.01 : 0.002;
        const next = clamp(v.zoom * Math.exp(-e.deltaY * factor), MIN_ZOOM, MAX_ZOOM);
        // Keep the point under the cursor fixed while scaling.
        return {
          zoom: next,
          x: px - ((px - v.x) * next) / v.zoom,
          y: py - ((py - v.y) * next) / v.zoom,
        };
      });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const px = rect.width / 2;
    const py = rect.height / 2;
    setView((v) => {
      const next = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      return { zoom: next, x: px - ((px - v.x) * next) / v.zoom, y: py - ((py - v.y) * next) / v.zoom };
    });
  };

  /* ---------------------------------------------------------------- */
  /* Pointer gestures                                                  */
  /* ---------------------------------------------------------------- */

  const onPointerDown = (e) => {
    if (e.button === 1 || e.altKey || tool === "pan") {
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, view };
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0 || !natural?.width) return;

    const p = toImage(e.clientX, e.clientY);

    // A click on empty space in select mode pans, so the user is never stuck
    // with no way to reposition. The background rect is the hit target, so
    // that is what identifies "empty space" here.
    if (tool === "select" && e.target?.dataset?.stageBg) {
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, view };
      setPanning(true);
      onSelect(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === "draw") {
      dragRef.current = { kind: "draw", origin: p };
      setDraft({ x: p.x, y: p.y, width: 0, height: 0 });
      return;
    }

    // Resize grips are rendered inside the overlay, so they stop propagation
    // and never reach this handler.
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "pan") {
      setView({
        ...drag.view,
        x: drag.view.x + (e.clientX - drag.startX),
        y: drag.view.y + (e.clientY - drag.startY),
      });
      return;
    }

    const p = toImage(e.clientX, e.clientY);

    if (drag.kind === "draw") {
      setDraft(boxFromPoints(drag.origin, p));
      return;
    }

    if (drag.kind === "move") {
      const box = boxFromPoints(drag.origin, p, drag.box);
      drag.current = box;
      setDraft(box);
      return;
    }

    if (drag.kind === "resize") {
      const box = resizeBox(drag.box, drag.handle, p.x - drag.origin.x, p.y - drag.origin.y);
      drag.current = box;
      setDraft(box);
    }
  };

  const onPointerUp = (e) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setPanning(false);
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraft(null);
    if (drag.kind === "pan" || !drag.current) return;

    if (isDegenerate(drag.current)) return;

    const normalized = displayToNormalized(drag.current, natural);
    if (normalized.width <= 0 || normalized.height <= 0) return;

    if (drag.kind === "draw") onCreate?.(normalized);
    if (drag.kind === "move" || drag.kind === "resize") onUpdate?.(drag.id, normalized);
  };

  // Cancels an in-flight gesture if the pointer is released outside the stage.
  useEffect(() => {
    const cancel = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDraft(null);
        setPanning(false);
      }
    };
    window.addEventListener("pointerup", cancel);
    return () => window.removeEventListener("pointerup", cancel);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Drag entry points used by the overlay                             */
  /* ---------------------------------------------------------------- */

  const startMove = (e, ann) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(ann.id);
    const box = normalizedToDisplay(ann.box, natural);
    // The origin is captured in *image* space, the same space onPointerMove
    // converts into. Mixing a screen coordinate into that subtraction is what
    // makes a box jump by the pan offset the moment the stage is scrolled.
    dragRef.current = {
      kind: "move",
      id: ann.id,
      origin: toImage(e.clientX, e.clientY),
      box,
      current: box,
    };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const startResize = (e, ann, handleId) => {
    e.stopPropagation();
    onSelect(ann.id);
    const box = normalizedToDisplay(ann.box, natural);
    dragRef.current = {
      kind: "resize",
      id: ann.id,
      handle: handleId,
      origin: toImage(e.clientX, e.clientY),
      box,
      current: box,
    };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        dragRef.current = null;
        setDraft(null);
        setPanning(false);
        onSelect?.(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          onDelete?.(selectedId);
        }
        return;
      }
      if ((e.key === "0" && (e.metaKey || e.ctrlKey)) || e.key === "f") {
        e.preventDefault();
        fit();
        return;
      }
      // Nudge the selected box. 1px reads as a rounding error at high zoom but
      // is a real correction at fit-zoom, which is where most work happens.
      const nudges = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (nudges[e.key] && selectedId) {
        e.preventDefault();
        const ann = annotations.find((a) => a.id === selectedId);
        if (!ann) return;
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = nudges[e.key];
        const box = normalizedToDisplay(ann.box, natural);
        const moved = {
          x: box.x + dx * step,
          y: box.y + dy * step,
          width: box.width,
          height: box.height,
        };
        onUpdate?.(selectedId, displayToNormalized(moved, natural));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotations, selectedId, natural, onSelect, onUpdate, onDelete, fit]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (!natural?.width) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-base-content/40">
        {children ?? "No media loaded"}
      </div>
    );
  }

  const cursor =
    tool === "draw" ? "crosshair" : panning ? "grabbing" : "default";

  return (
    <div className="relative w-full h-full">
      <div
        ref={stageRef}
        className="relative w-full h-full overflow-hidden bg-neutral rounded-box touch-none select-none"
        style={{ cursor }}
      >
        <div
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "0 0",
            width: natural.width,
            height: natural.height,
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {children}

          <svg
            ref={svgRef}
            className="absolute inset-0"
            width={natural.width}
            height={natural.height}
            viewBox={`0 0 ${natural.width} ${natural.height}`}
            style={{ overflow: "visible" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* An SVG hit-tests per shape, so the empty parts of the root are
                transparent to the pointer. This full-size rect is what makes
                the media beneath it drawable. Its events bubble to the <svg>,
                which owns the handlers and the pointer capture. */}
            <rect
              x={0}
              y={0}
              width={natural.width}
              height={natural.height}
              fill="transparent"
              data-stage-bg="1"
            />

            {annotations.map((ann) => {
              const b = normalizedToDisplay(ann.box, natural);
              const isSelected = ann.id === selectedId;
              const color = colorFor(ann);
              return (
                <g key={ann.id} style={{ cursor: "move" }} onPointerDown={(e) => startMove(e, ann)}>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.width}
                    height={b.height}
                    fill={color}
                    fillOpacity={isSelected ? 0.22 : 0.12}
                    stroke={color}
                    strokeWidth={(isSelected ? 2.5 : 1.5) / view.zoom}
                    strokeDasharray={
                      ann.kind === "classification"
                        ? `${6 / view.zoom} ${4 / view.zoom}`
                        : undefined
                    }
                  />
                  <text
                    x={b.x + 3 / view.zoom}
                    y={b.y - 5 / view.zoom}
                    fill={color}
                    fontSize={13 / view.zoom}
                    fontWeight="600"
                    style={{ paintOrder: "stroke", pointerEvents: "none" }}
                    stroke="rgba(0,0,0,0.75)"
                    strokeWidth={3 / view.zoom}
                  >
                    {ann.label}
                  </text>

                  {isSelected &&
                    HANDLES.map((h) => (
                      <rect
                        key={h.id}
                        x={b.x + b.width * h.cx - HANDLE_HIT / 2 / view.zoom}
                        y={b.y + b.height * h.cy - HANDLE_HIT / 2 / view.zoom}
                        width={HANDLE_HIT / view.zoom}
                        height={HANDLE_HIT / view.zoom}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={1.5 / view.zoom}
                        style={{ cursor: h.cursor }}
                        onPointerDown={(e) => startResize(e, ann, h.id)}
                      />
                    ))}
                </g>
              );
            })}

            {draft && (
              <rect
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                fill="#22d3ee"
                fillOpacity={0.18}
                stroke="#22d3ee"
                strokeWidth={2 / view.zoom}
                strokeDasharray={`${5 / view.zoom} ${4 / view.zoom}`}
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 join bg-base-100/90 backdrop-blur border border-base-content/10 rounded-lg">
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => zoomBy(1 / 1.25)}
          title="Zoom out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="btn btn-xs join-item pointer-events-none border-0 font-mono text-[10px] min-w-12">
          {Math.round(view.zoom * 100)}%
        </span>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={() => zoomBy(1.25)}
          title="Zoom in"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-xs join-item border-0"
          onClick={fit}
          title="Fit to view (F)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** A box from a drag origin and a current point, in any order. */
function boxFromPoints(a, b, from = null) {
  if (from) {
    return {
      x: from.x + (b.x - a.x),
      y: from.y + (b.y - a.y),
      width: from.width,
      height: from.height,
    };
  }
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}
