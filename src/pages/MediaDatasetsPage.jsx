// src/pages/MediaDatasetsPage.jsx
// Lists the image/video datasets and creates new ones.
//
// Deliberately separate from the text DatasetsPage: a media dataset holds
// files, not a CSV, and its counters mean something different (assets and
// bytes, not comments and rows). Merging them would make both pages worse.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Plus,
  Search,
  Shapes,
  Trash2,
} from "lucide-react";

import {
  createMediaDataset,
  deleteMediaDataset,
  listLabelSets,
  listMediaDatasets,
} from "../services/mediaApi";
import { getErrorMessage } from "../services/getErrorMessage";
import { alertError, confirmDelete, toast } from "../lib/swal";
import { useAuth } from "../context/useAuth";
import { formatBytes, formatCount } from "../lib/format";

const QK = ["media", "datasets"];

const KIND_META = {
  image: { icon: ImageIcon, label: "Images", badge: "badge-info" },
  video: { icon: Film, label: "Videos", badge: "badge-secondary" },
  mixed: { icon: Layers, label: "Mixed", badge: "badge-ghost" },
};

export default function MediaDatasetsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: () => listMediaDatasets({ limit: 100 }),
  });

  const datasets = useMemo(() => data?.datasets || [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q),
    );
  }, [datasets, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5" />
            </div>
            Media Datasets
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Image and video datasets for bounding-box and classification
            training.
          </p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary btn-sm gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            New Dataset
          </button>
        )}
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Search media datasets…"
          className="input input-sm input-bordered w-full pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 w-full rounded-box" />
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-error text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{getErrorMessage(error)}</span>
        </div>
      )}

      {!isLoading && datasets.length === 0 && (
        <EmptyMedia onCreate={isAdmin ? () => setCreating(true) : null} />
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <MediaDatasetCard
              key={d._id}
              dataset={d}
              canEdit={isAdmin}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateDatasetModal onClose={() => setCreating(false)} onCreated={invalidate} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function MediaDatasetCard({ dataset, canEdit }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[dataset.mediaKind] || KIND_META.mixed;
  const Icon = meta.icon;

  const remove = useMutation({
    mutationFn: () => deleteMediaDataset(dataset._id),
    onSuccess: () => {
      toast("Dataset deleted");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: (err) => alertError("Delete failed", getErrorMessage(err)),
  });

  const handleDelete = async () => {
    const ok = await confirmDelete(
      `Delete "${dataset.name}"?`,
      `This permanently removes ${formatCount(dataset.totalAssets, "asset")} and ${formatCount(
        dataset.totalAnnotations,
        "annotation",
      )}, including the files on disk. This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    remove.mutate();
  };

  return (
    <article className="card bg-base-100 border border-base-content/5 hover:border-primary/30 transition-colors">
      <div className="card-body p-5 gap-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/media/datasets/${dataset._id}`}
            className="min-w-0 flex-1 group"
          >
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
              {dataset.name}
            </h3>
            <p className="text-xs text-base-content/50 mt-0.5 line-clamp-2 min-h-8">
              {dataset.description || "No description"}
            </p>
          </Link>
          {canEdit && (
            <button
              className="btn btn-ghost btn-xs text-error shrink-0"
              onClick={handleDelete}
              disabled={busy}
              title="Delete dataset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`badge badge-sm gap-1 ${meta.badge}`}>
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          {dataset.labelSetName && (
            <span className="badge badge-sm badge-outline gap-1">
              <Shapes className="w-3 h-3" />
              {dataset.labelSetName}
            </span>
          )}
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-base-content/60 mb-1">
            <span>
              {formatCount(dataset.annotatedAssets, "asset")} of{" "}
              {formatCount(dataset.totalAssets, "asset")} annotated
            </span>
            <span className="font-mono">
              {Math.round((dataset.annotatedRatio || 0) * 100)}%
            </span>
          </div>
          <progress
            className="progress progress-primary w-full h-1.5"
            value={Math.round((dataset.annotatedRatio || 0) * 100)}
            max={100}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-base-content/50 border-t border-base-content/5 pt-3">
          <span>{formatCount(dataset.totalAnnotations, "annotation")}</span>
          <span>{formatBytes(dataset.totalBytes)}</span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

function CreateDatasetModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", mediaKind: "image", labelSetId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: labelSets } = useQuery({
    queryKey: ["media", "labelSets", false],
    queryFn: () => listLabelSets(false),
  });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Name is required");

    setSaving(true);
    try {
      await createMediaDataset({
        name: form.name.trim(),
        description: form.description.trim(),
        mediaKind: form.mediaKind,
        labelSetId: form.labelSetId || undefined,
      });
      toast("Dataset created");
      onCreated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">New media dataset</h3>

        <form onSubmit={submit} className="space-y-4">
          <label className="form-control">
            <span className="label-text text-xs font-semibold mb-1.5">Name</span>
            <input
              className="input input-sm input-bordered w-full"
              placeholder="Cityscapes subset"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </label>

          <label className="form-control">
            <span className="label-text text-xs font-semibold mb-1.5">
              Description
            </span>
            <textarea
              className="textarea textarea-sm textarea-bordered w-full"
              rows={2}
              placeholder="Optional"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1.5">Media type</span>
              <select
                className="select select-sm select-bordered w-full"
                value={form.mediaKind}
                onChange={(e) => setForm({ ...form, mediaKind: e.target.value })}
              >
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1.5">Label set</span>
              <select
                className="select select-sm select-bordered w-full"
                value={form.labelSetId}
                onChange={(e) => setForm({ ...form, labelSetId: e.target.value })}
              >
                <option value="">None yet</option>
                {(labelSets || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.labels?.length || 0})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(labelSets || []).length === 0 && (
            <p className="text-xs text-base-content/50 bg-base-200 rounded p-2">
              No label sets yet. You can create one now, but annotation is
              blocked until a dataset has one — every box needs a class name.
            </p>
          )}

          {error && (
            <div className="alert alert-error py-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm gap-2" disabled={saving}>
              {saving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Create
            </button>
          </div>
        </form>
      </div>
      <button className="modal-backdrop" onClick={onClose} type="button" aria-label="Close" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty                                                               */
/* ------------------------------------------------------------------ */

function EmptyMedia({ onCreate }) {
  return (
    <div className="text-center py-16 border border-dashed border-base-content/15 rounded-box">
      <FolderOpen className="w-10 h-10 mx-auto text-base-content/20 mb-3" />
      <p className="text-sm text-base-content/60">
        No media datasets yet.
        {onCreate && " Create one, then upload images or videos to it."}
      </p>
      {onCreate && (
        <button className="btn btn-primary btn-sm mt-4" onClick={onCreate}>
          <Plus className="w-4 h-4" />
          New Dataset
        </button>
      )}
    </div>
  );
}
