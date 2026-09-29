// src/pages/MediaDatasetDetailPage.jsx
// One media dataset: its assets, its upload target, its class-balance stats
// and its exports.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Shapes,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import {
  deleteMediaAsset,
  getMediaDataset,
  listLabelSets,
  listMediaAssets,
  updateMediaDataset,
} from "../services/mediaApi";
import { getErrorMessage } from "../services/getErrorMessage";
import { alertError, confirmAction, confirmDelete, toast } from "../lib/swal";
import { useAuth } from "../context/useAuth";
import { formatBytes, formatCount, formatPercent } from "../lib/format";
import AssetThumbnail from "../components/media/AssetThumbnail";
import ExportPanel from "../components/media/ExportPanel";
import UploadDropzone from "../components/media/UploadDropzone";

const PAGE_SIZE = 48;
const QK = ["media", "dataset"];

export default function MediaDatasetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ status: "", kind: "", excludeAnnotated: false });
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const { data: dataset, isLoading, error } = useQuery({
    queryKey: [...QK, id],
    queryFn: () => getMediaDataset(id),
    enabled: Boolean(id),
  });

  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: [...QK, id, "assets", page, filter],
    queryFn: () =>
      listMediaAssets(id, {
        page,
        limit: PAGE_SIZE,
        status: filter.status || undefined,
        kind: filter.kind || undefined,
        excludeAnnotated: filter.excludeAnnotated || undefined,
      }),
    enabled: Boolean(id),
  });

  const assets = assetsData?.assets || [];
  const total = assetsData?.total || 0;
  const totalPages = assetsData?.totalPages || 1;

  const invalidateDataset = () => queryClient.invalidateQueries({ queryKey: [...QK, id] });
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: QK });
    queryClient.invalidateQueries({ queryKey: ["media", "datasets"] });
  };

  // Binding a label set is what unblocks annotation, and it is a
  // dataset-level change rather than a per-asset one, so it belongs here.
  const { data: labelSets } = useQuery({
    queryKey: ["media", "labelSets", true],
    queryFn: () => listLabelSets(true),
    enabled: isAdmin,
  });

  const bindLabelSet = useMutation({
    mutationFn: (labelSetId) => updateMediaDataset(id, { labelSetId }),
    onSuccess: () => {
      toast("Label set bound");
      invalidateDataset();
    },
    onError: (err) => alertError("Could not bind label set", getErrorMessage(err)),
  });

  const handleBindLabelSet = async (value) => {
    const next = value || null;
    if (next === (dataset?.labelSetId || null)) return;
    const ok = await confirmAction(
      "Change the label set?",
      next
        ? "New annotations will use these classes. Existing annotations keep the class they were saved with, and exports follow the saved names."
        : "This blocks annotation until a label set is bound again.",
      "Bind",
    );
    if (ok) bindLabelSet.mutate(next);
  };

  const remove = useMutation({
    mutationFn: (assetId) => deleteMediaAsset(assetId),
    onSuccess: () => {
      toast("Asset deleted");
      invalidateAll();
    },
    onError: (err) => alertError("Delete failed", getErrorMessage(err)),
  });

  const handleDeleteAsset = async (asset) => {
    const ok = await confirmDelete(
      "Delete this asset?",
      `"${asset.originalFileName}" and all of its annotations will be removed, including the file on disk.`,
    );
    if (!ok) return;
    remove.mutate(asset._id);
  };

  if (isLoading) return <div className="skeleton h-64 w-full rounded-box" />;

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/media" className="btn btn-ghost btn-sm gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to media datasets
        </Link>
        <div className="alert alert-error">
          <AlertCircle className="w-4 h-4" />
          <span>{getErrorMessage(error)}</span>
        </div>
      </div>
    );
  }

  if (!dataset) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/media"
            className="text-xs text-base-content/50 hover:text-primary inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Media datasets
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{dataset.name}</h1>
          {dataset.description && (
            <p className="text-sm text-base-content/60 mt-1">{dataset.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="badge badge-sm badge-info gap-1">
              {dataset.mediaKind === "video" ? (
                <Film className="w-3 h-3" />
              ) : dataset.mediaKind === "image" ? (
                <ImageIcon className="w-3 h-3" />
              ) : (
                <Layers className="w-3 h-3" />
              )}
              {dataset.mediaKind}
            </span>
            {dataset.labelSetName ? (
              <span className="badge badge-sm badge-outline gap-1">
                <Shapes className="w-3 h-3" />
                {dataset.labelSetName}
              </span>
            ) : (
              <span className="badge badge-sm badge-warning gap-1">
                no label set — annotation is blocked
              </span>
            )}
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 mt-3">
              <span className="text-[11px] text-base-content/50 shrink-0">Label set</span>
              <select
                className="select select-xs select-bordered max-w-56"
                value={dataset.labelSetId || ""}
                disabled={bindLabelSet.isPending}
                onChange={(e) => handleBindLabelSet(e.target.value)}
              >
                <option value="">— none —</option>
                {(labelSets || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.labels?.length || 0})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => setShowUpload((v) => !v)}
            >
              <ImageIcon className="w-4 h-4" />
              Upload
            </button>
          )}
          <button
            className="btn btn-sm gap-2"
            onClick={() => setShowExport((v) => !v)}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {showUpload && isAdmin && (
        <div className="card bg-base-100 border border-base-content/5">
          <div className="card-body p-5">
            <UploadDropzone
              datasetId={dataset._id}
              onUploaded={() => {
                invalidateAll();
                if (total === 0) setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {showExport && (
        <div className="card bg-base-100 border border-base-content/5">
          <div className="card-body p-5">
            <ExportPanel dataset={dataset} />
          </div>
        </div>
      )}

      {/* Stats */}
      <StatsRow dataset={dataset} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-base-content/40" />
        <select
          className="select select-xs select-bordered"
          value={filter.status}
          onChange={(e) => {
            setFilter({ ...filter, status: e.target.value });
            setPage(1);
          }}
        >
          <option value="">all statuses</option>
          <option value="pending">pending</option>
          <option value="annotated">annotated</option>
        </select>
        <select
          className="select select-xs select-bordered"
          value={filter.kind}
          onChange={(e) => {
            setFilter({ ...filter, kind: e.target.value });
            setPage(1);
          }}
        >
          <option value="">all kinds</option>
          <option value="image">images</option>
          <option value="video">videos</option>
        </select>
        <label className="label cursor-pointer gap-1.5">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={filter.excludeAnnotated}
            onChange={(e) => {
              setFilter({ ...filter, excludeAnnotated: e.target.checked });
              setPage(1);
            }}
          />
          <span className="label-text text-xs">unannotated only</span>
        </label>
        <span className="text-xs text-base-content/50 ml-auto">
          {formatCount(total, "asset")}
        </span>
      </div>

      {/* Grid */}
      {assetsLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-box" />
          ))}
        </div>
      )}

      {!assetsLoading && assets.length === 0 && (
        <div className="text-center py-16 border border-dashed border-base-content/15 rounded-box">
          <ImageIcon className="w-10 h-10 mx-auto text-base-content/20 mb-3" />
          <p className="text-sm text-base-content/60">
            {total === 0
              ? isAdmin
                ? "No assets yet. Upload images or videos to get started."
                : "No assets yet."
              : "No assets match these filters."}
          </p>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {assets.map((a) => (
              <AssetCell
                key={a._id}
                asset={a}
                canEdit={isAdmin}
                onOpen={() => navigate(`/media/datasets/${id}/annotate/${a._id}`)}
                onDelete={handleDeleteAsset}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                className="btn btn-xs gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="text-xs font-mono text-base-content/60">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-xs gap-1"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Asset cell                                                          */
/* ------------------------------------------------------------------ */

function AssetCell({ asset, canEdit, onOpen, onDelete }) {
  return (
    <div className="relative group">
      <AssetThumbnail asset={asset} onClick={onOpen} />
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1.5 left-1.5 btn btn-xs btn-circle btn-error opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
          title="Delete asset"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function StatsRow({ dataset }) {
  const stats = dataset.stats || {};
  const histogram = stats.labelHistogram || [];
  const top = histogram.slice(0, 5);
  const max = Math.max(1, ...top.map((h) => h.count));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat
        label="Assets"
        value={formatCount(dataset.totalAssets, "asset")}
        sub={`${formatBytes(dataset.totalBytes)} total`}
      />
      <Stat
        label="Annotated"
        value={formatPercent(dataset.annotatedRatio || 0)}
        sub={`${dataset.annotatedAssets} of ${dataset.totalAssets}`}
        progress={Math.round((dataset.annotatedRatio || 0) * 100)}
      />
      <Stat
        label="Annotations"
        value={formatCount(dataset.totalAnnotations, "annotation")}
        sub={`${stats.totalBoxes ?? 0} boxes`}
      />
      <Stat
        label="Class balance"
        value={stats.totalBoxes > 0 ? formatPercent(stats.classBalance) : "—"}
        sub={stats.totalBoxes > 0 ? "1 = perfectly even" : "no boxes yet"}
        progress={stats.totalBoxes > 0 ? Math.round((stats.classBalance || 0) * 100) : 0}
      />

      {top.length > 0 && (
        <div className="col-span-2 md:col-span-4 card bg-base-100 border border-base-content/5">
          <div className="card-body p-4">
            <p className="text-xs font-semibold text-base-content/60 mb-2">
              Class distribution
            </p>
            <div className="space-y-1.5">
              {top.map((h) => (
                <div key={h.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-32 truncate">{h.label}</span>
                  <progress
                    className="progress progress-primary flex-1 h-2"
                    value={h.count}
                    max={max}
                  />
                  <span className="text-xs text-base-content/50 font-mono w-10 text-right">
                    {h.count}
                  </span>
                </div>
              ))}
            </div>
            {histogram.length > top.length && (
              <p className="text-[10px] text-base-content/40 mt-1">
                + {histogram.length - top.length} more classes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, progress }) {
  return (
    <div className="card bg-base-100 border border-base-content/5">
      <div className="card-body p-4">
        <p className="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold">
          {label}
        </p>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        {progress !== undefined && (
          <progress className="progress progress-primary h-1.5" value={progress} max={100} />
        )}
        {sub && <p className="text-[10px] text-base-content/45">{sub}</p>}
      </div>
    </div>
  );
}
