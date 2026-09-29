// src/pages/MediaAnnotatePage.jsx
// The labelling workspace for one asset: draw on the media, manage the boxes,
// inspect history, and move on to the next asset.
//
// Shape of the flow, and why:
//   - Creating a box saves immediately. There is no "save" button, because a
//     lost annotation is worse than a slightly wrong one, and every save is a
//     version anyway.
//   - Moving or resizing a box also saves on pointer-up — not on every frame
//     of the drag — so one gesture is one version rather than two hundred.
//   - Restore is deliberately absent from the box list. The API only restores
//     a *deleted* annotation, and it does so by creating a new row; it is
//     reachable from the history panel instead, which is where "bring this
//     back" belongs.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  MousePointer2,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";

import {
  annotationHistory,
  createAnnotation,
  deleteAnnotation,
  getMediaAsset,
  getMediaDataset,
  listAssetAnnotations,
  listLabelSets,
  listMediaAssets,
  restoreAnnotation,
  updateAnnotation,
} from "../services/mediaApi";
import useAssetObjectUrl from "../hooks/useAssetObjectUrl";
import useVideoFrameSource from "../components/media/useVideoFrameSource";
import AnnotationCanvas from "../components/media/AnnotationCanvas";
import { labelColor } from "../lib/mediaGeometry";
import { formatDuration, formatTimestamp } from "../lib/format";
import { getErrorMessage } from "../services/getErrorMessage";
import { alertError, confirmDelete, toast } from "../lib/swal";
import { useAuth } from "../context/useAuth";

const QK = ["media", "annotate"];

export default function MediaAnnotatePage() {
  const { datasetId, assetId } = useParams();

  // Keying on the asset remounts the workspace on navigation, which is how
  // per-asset state (tool, selection, view, frame position) is reset. The
  // alternative — resetting it in an effect on assetId — costs an extra render
  // and can show the previous asset's selection over the new one.
  return <AnnotateWorkspace key={assetId} datasetId={datasetId} assetId={assetId} />;
}

function AnnotateWorkspace({ datasetId, assetId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tool, setTool] = useState("select");
  const [activeLabel, setActiveLabel] = useState(null);
  const [activeKind, setActiveKind] = useState("bbox");
  const [selectedId, setSelectedId] = useState(null);
  const [timestampMs, setTimestampMs] = useState(0);
  const [natural, setNatural] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const assetQueryKey = [...QK, assetId];

  const { data: dataset } = useQuery({
    queryKey: ["media", "dataset", datasetId],
    queryFn: () => getMediaDataset(datasetId),
    enabled: Boolean(datasetId),
  });

  const { data: labelSets } = useQuery({
    queryKey: ["media", "labelSets", true],
    queryFn: () => listLabelSets(true),
  });

  const {
    data: asset,
    isLoading: assetLoading,
    error: assetError,
  } = useQuery({
    queryKey: assetQueryKey,
    queryFn: () => getMediaAsset(assetId),
    enabled: Boolean(assetId),
  });

  const { data: annotations, isLoading: annLoading } = useQuery({
    queryKey: [...QK, assetId, "annotations"],
    queryFn: () => listAssetAnnotations(assetId),
    enabled: Boolean(assetId),
  });

  // Ordered id list for previous/next. Capped — a 10k-asset dataset would be
  // a wasteful fetch for the sake of two arrow buttons.
  const { data: siblings } = useQuery({
    queryKey: [...QK, datasetId, "ids"],
    queryFn: () => listMediaAssets(datasetId, { limit: 200 }),
    enabled: Boolean(datasetId),
  });

  const { url, loading: mediaLoading, error: mediaError } = useAssetObjectUrl(assetId);

  const isVideo = asset?.kind === "video";
  const onDimensions = useCallback(
    (width, height) => setNatural({ width, height }),
    [],
  );
  const video = useVideoFrameSource({
    url,
    durationMs: asset?.durationMs || 0,
    timestampMs,
    onTimestampChange: setTimestampMs,
    onDimensions,
  });

  /* ---------------------------------------------------------------- */
  /* Derived                                                           */
  /* ---------------------------------------------------------------- */

  const labelSet = useMemo(
    () => (labelSets || []).find((s) => s._id === dataset?.labelSetId) || null,
    [labelSets, dataset],
  );
  const labels = useMemo(() => labelSet?.labels || [], [labelSet]);
  const list = annotations || [];

  // The class a new box gets. Derived rather than seeded by an effect, so a
  // box is never drawn with an undefined class while the effect catches up.
  const effectiveLabel = activeLabel ?? labels[0]?.value ?? null;

  const colorFor = useCallback(
    (ann) =>
      labelColor(
        labels.find((l) => l.value === ann.label) || { value: ann.label },
      ),
    [labels],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...QK, assetId] });
    queryClient.invalidateQueries({ queryKey: ["media", "dataset", datasetId] });
  };

  /* ---------------------------------------------------------------- */
  /* Sibling navigation                                                */
  /* ---------------------------------------------------------------- */

  const ids = useMemo(
    () => (siblings?.assets || []).map((a) => a._id),
    [siblings],
  );
  const index = ids.indexOf(assetId);
  const prevId = index > 0 ? ids[index - 1] : null;
  const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;

  const go = useCallback(
    (id) => {
      if (id) navigate(`/media/datasets/${datasetId}/annotate/${id}`);
    },
    [datasetId, navigate],
  );

  // Keyboard: A/D or arrows to move between assets when not editing a field.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.target?.closest?.(".stage-focus")) return;
      if (e.key === "a" || e.key === "ArrowLeft") go(prevId);
      if (e.key === "d" || e.key === "ArrowRight") go(nextId);
      if (e.key === "v") setTool("select");
      if (e.key === "b") setTool("draw");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, go]);

  /* ---------------------------------------------------------------- */
  /* Mutations                                                         */
  /* ---------------------------------------------------------------- */

  const create = useMutation({
    mutationFn: (payload) => createAnnotation(assetId, payload),
    onSuccess: (ann) => {
      invalidate();
      setSelectedId(ann.id);
      setTool("select");
    },
    onError: (err) => alertError("Could not save annotation", getErrorMessage(err)),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }) => updateAnnotation(id, patch),
    onSuccess: invalidate,
    onError: (err) => alertError("Could not update", getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id) => deleteAnnotation(id),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
      toast("Annotation deleted — restorable from history");
    },
    onError: (err) => alertError("Could not delete", getErrorMessage(err)),
  });

  const handleCreate = (box) => {
    if (!effectiveLabel) {
      alertError("Pick a class first", "A box needs a class name to export correctly.");
      return;
    }
    const payload = {
      kind: activeKind,
      label: effectiveLabel,
      box,
    };
    if (isVideo) payload.timestampMs = timestampMs;
    create.mutate(payload);
  };

  const handleUpdate = (id, box) => {
    const patch = { box };
    update.mutate({ id, patch });
  };

  const handleDelete = async (ann) => {
    const ok = await confirmDelete(
      "Delete this annotation?",
      `"${ann.label}" will be removed from the image. It stays in the history and can be restored.`,
    );
    if (!ok) return;
    remove.mutate(ann.id);
  };

  const handleRelabel = (ann, label) => {
    if (!label || label === ann.label) return;
    update.mutate({ id: ann.id, patch: { label } });
  };

  /* ---------------------------------------------------------------- */
  /* Guards & render                                                   */
  /* ---------------------------------------------------------------- */

  if (assetLoading) return <div className="skeleton h-[70vh] w-full rounded-box" />;

  if (assetError || !asset) {
    return (
      <div className="space-y-4">
        <Link to={`/media/datasets/${datasetId}`} className="btn btn-ghost btn-sm gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="alert alert-error">
          <AlertCircle className="w-4 h-4" />
          <span>{getErrorMessage(assetError) || "Asset not found"}</span>
        </div>
      </div>
    );
  }

  if (!labelSet || labels.length === 0) {
    return (
      <div className="space-y-4">
        <Link to={`/media/datasets/${datasetId}`} className="btn btn-ghost btn-sm gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to dataset
        </Link>
        <div className="alert alert-warning">
          <AlertCircle className="w-4 h-4" />
          <div>
            <p className="font-semibold">This dataset has no label set</p>
            <p className="text-xs mt-0.5">
              Every annotation needs a class name, because that name becomes the
              class index in an export. {isAdmin && "Bind one from the dataset page to start."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/media/datasets/${datasetId}`}
            className="btn btn-ghost btn-sm btn-square shrink-0"
            title="Back to dataset"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <p className="font-semibold truncate text-sm">{dataset?.name}</p>
            <p className="text-xs text-base-content/50 truncate font-mono">
              {asset.originalFileName}
              {isVideo && ` · ${formatDuration(asset.durationMs)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-xs gap-1"
            disabled={!prevId}
            onClick={() => go(prevId)}
            title="Previous asset (A)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-base-content/50 px-1">
            {index >= 0 ? `${index + 1} / ${ids.length}` : "—"}
          </span>
          <button
            className="btn btn-xs gap-1"
            disabled={!nextId}
            onClick={() => go(nextId)}
            title="Next asset (D)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-3 min-h-0">
        {/* Canvas column */}
        <div className="flex flex-col gap-2 min-h-0">
          <Toolbar
            tool={tool}
            setTool={setTool}
            activeKind={activeKind}
            setActiveKind={setActiveKind}
            activeLabel={effectiveLabel}
            setActiveLabel={setActiveLabel}
            labels={labels}
            selected={list.find((a) => a.id === selectedId)}
            onRelabel={handleRelabel}
            onDelete={handleDelete}
          />

          <div className="flex-1 min-h-0">
            {mediaError ? (
              <div className="alert alert-error h-full">
                <AlertCircle className="w-4 h-4" />
                <span>{mediaError}</span>
              </div>
            ) : mediaLoading || !url || !natural ? (
              <div className="w-full h-full flex items-center justify-center bg-neutral rounded-box">
                <span className="loading loading-spinner loading-md text-white/30" />
              </div>
            ) : (
              <AnnotationCanvas
                natural={natural}
                annotations={list}
                selectedId={selectedId}
                tool={tool}
                onSelect={setSelectedId}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                onDelete={(id) => remove.mutate(id)}
                colorFor={colorFor}
              >
                {isVideo ? (
                  <video {...video.mediaProps} />
                ) : (
                  <img
                    src={url}
                    alt={asset.originalFileName}
                    className="absolute inset-0 w-full h-full"
                    draggable={false}
                    onLoad={(e) =>
                      onDimensions(e.target.naturalWidth, e.target.naturalHeight)
                    }
                  />
                )}
              </AnnotationCanvas>
            )}
          </div>

          {/* Video transport */}
          {isVideo && natural && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {video.controls}
              <input
                type="range"
                min={0}
                max={Math.max(1, asset.durationMs || 0)}
                value={timestampMs}
                onChange={(e) => video.seekTo(Number(e.target.value))}
                className="range range-primary range-xs flex-1 min-w-40"
                title="Scrub"
              />
              <span className="text-[10px] font-mono text-base-content/60 w-24 text-right">
                {formatTimestamp(timestampMs)} / {formatDuration(asset.durationMs)}
              </span>
              <span className="badge badge-sm badge-ghost gap-1">
                <Clock className="w-3 h-3" />
                frame ≈ {Math.round(timestampMs / (1000 / 30))}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col min-h-0 lg:max-h-full">
          <div className="tabs tabs-box tabs-sm shrink-0">
            <button
              className={`tab ${!showHistory ? "tab-active" : ""}`}
              onClick={() => setShowHistory(false)}
            >
              Boxes ({list.length})
            </button>
            <button
              className={`tab ${showHistory ? "tab-active" : ""}`}
              onClick={() => setShowHistory(true)}
            >
              History
            </button>
          </div>

          {showHistory ? (
            <HistoryPanel
              annotations={list}
              selectedId={selectedId}
            />
          ) : (
            <AnnotationList
              loading={annLoading}
              annotations={list}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={handleDelete}
              colorFor={colorFor}
              isVideo={isVideo}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function Toolbar({
  tool,
  setTool,
  activeKind,
  setActiveKind,
  activeLabel,
  setActiveLabel,
  labels,
  selected,
  onRelabel,
  onDelete,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <div className="join">
        <button
          className={`btn btn-xs join-item gap-1.5 ${tool === "select" ? "btn-primary" : ""}`}
          onClick={() => setTool("select")}
          title="Select / move (V)"
        >
          <MousePointer2 className="w-3.5 h-3.5" />
          Select
        </button>
        <button
          className={`btn btn-xs join-item gap-1.5 ${tool === "draw" ? "btn-primary" : ""}`}
          onClick={() => setTool("draw")}
          title="Draw a box (B)"
        >
          <Square className="w-3.5 h-3.5" />
          Draw
        </button>
      </div>

      <select
        className="select select-xs select-bordered w-24"
        value={activeKind}
        onChange={(e) => {
          setActiveKind(e.target.value);
          setTool("draw");
        }}
        title="What to draw"
      >
        <option value="bbox">Box</option>
        <option value="classification">Whole image</option>
      </select>

      <div className="flex flex-wrap gap-1">
        {labels.map((l) => (
          <button
            key={l.value}
            onClick={() => setActiveLabel(l.value)}
            className={`badge badge-sm gap-1.5 cursor-pointer transition-all ${
              activeLabel === l.value ? "badge-primary" : "badge-ghost"
            }`}
            title={`Draw as "${l.label}"`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: labelColor(l) }}
            />
            {l.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {selected && (
          <>
            <select
              className="select select-xs select-bordered w-32"
              value={selected.label}
              onChange={(e) => onRelabel(selected, e.target.value)}
              title="Change class"
            >
              {labels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-xs btn-ghost text-error gap-1"
              onClick={() => onDelete(selected)}
              title="Delete (Del)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <span className="text-[10px] text-base-content/40 hidden xl:inline">
          scroll = zoom · space = pan · F = fit · Del = delete
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Annotation list                                                     */
/* ------------------------------------------------------------------ */

function AnnotationList({
  loading,
  annotations,
  selectedId,
  onSelect,
  onDelete,
  colorFor,
  isVideo,
}) {
  if (loading) return <div className="skeleton flex-1 rounded-box" />;

  if (annotations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <Square className="w-8 h-8 mx-auto text-base-content/15 mb-2" />
          <p className="text-sm text-base-content/60">No annotations yet</p>
          <p className="text-xs text-base-content/40 mt-1">
            Pick <span className="font-semibold">Draw</span> and drag on the image
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1 mt-2">
      {annotations.map((ann) => {
        const color = colorFor(ann);
        const selected = ann.id === selectedId;
        return (
          <div
            key={ann.id}
            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
              selected
                ? "border-primary bg-primary/5"
                : "border-base-content/10 hover:border-base-content/25"
            }`}
            onClick={() => onSelect(ann.id)}
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{ann.label}</p>
              <p className="text-[10px] text-base-content/45 font-mono">
                {ann.kind === "classification"
                  ? "whole image"
                  : `${Math.round(ann.box.width * 100)}% × ${Math.round(
                      ann.box.height * 100,
                    )}%`}
                {isVideo && ann.timestampMs !== null && ` · ${formatTimestamp(ann.timestampMs)}`}
              </p>
            </div>
            {ann.revision > 1 && (
              <span className="badge badge-xs badge-ghost font-mono" title="Revisions">
                r{ann.revision}
              </span>
            )}
            <button
              className="btn btn-ghost btn-xs text-error shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ann);
              }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function HistoryPanel({ annotations, selectedId }) {
  const queryClient = useQueryClient();
  const targetId = selectedId || annotations[0]?.id;
  const [expanded, setExpanded] = useState(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: [...QK, targetId, "history"],
    queryFn: () => annotationHistory(targetId),
    enabled: Boolean(targetId),
  });

  const restore = useMutation({
    mutationFn: (id) => restoreAnnotation(id),
    onSuccess: () => {
      toast("Annotation restored as a new box");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: (err) => alertError("Restore failed", getErrorMessage(err)),
  });

  if (!targetId) {
    return (
      <p className="text-xs text-base-content/50 p-4 text-center">
        Select an annotation to see its revision history.
      </p>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto mt-2">
      {isLoading && <div className="skeleton h-40 rounded-box" />}

      {versions?.map((v) => {
        const isOpen = expanded === `${v.annotationId}-${v.revision}`;
        return (
          <div
            key={`${v.annotationId}-${v.revision}`}
            className="border-b border-base-content/5 last:border-0"
          >
            <button
              className="w-full flex items-center gap-2 py-2 px-1 text-left hover:bg-base-200/50 rounded"
              onClick={() =>
                setExpanded(isOpen ? null : `${v.annotationId}-${v.revision}`)
              }
            >
              <History className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
              <span className="badge badge-xs badge-ghost font-mono shrink-0">
                r{v.revision}
              </span>
              <span className="text-xs font-medium">{v.changeType}</span>
              <span className="text-[10px] text-base-content/45 truncate ml-auto">
                {new Date(v.createdAt).toLocaleString()}
              </span>
            </button>

            {isOpen && (
              <div className="px-2 pb-2 space-y-1.5">
                <p className="text-[11px] font-mono text-base-content/60">
                  {v.snapshot?.label}
                  {v.snapshot?.box
                    ? ` · [${v.snapshot.box.x}, ${v.snapshot.box.y}, ${v.snapshot.box.width}, ${v.snapshot.box.height}]`
                    : " · whole image"}
                </p>
                {v.changedFields?.length > 0 && (
                  <p className="text-[10px] text-base-content/50">
                    changed: {v.changedFields.join(", ")}
                  </p>
                )}
                {v.changeType === "delete" && (
                  <button
                    className="btn btn-xs btn-outline gap-1"
                    onClick={() => restore.mutate(v.annotationId)}
                    disabled={restore.isPending}
                  >
                    <Undo2 className="w-3 h-3" />
                    Restore
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
