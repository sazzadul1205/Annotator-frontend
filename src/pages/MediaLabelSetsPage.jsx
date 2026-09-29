// src/pages/MediaLabelSetsPage.jsx
// Admin CRUD for the class vocabulary used by the image/video domain.
//
// A label set's `value` is the slug — "Stop Sign" becomes "stop_sign" — and
// that slug is what appears in every COCO category and every YOLO class index.
// Renaming a label's *text* is therefore safe; changing what the set contains
// after annotations exist is not, which is why the server refuses to rebind a
// label set on a dataset that already has annotations.
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Plus,
  Power,
  PowerOff,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import {
  createLabelSet,
  deleteLabelSet,
  listLabelSets,
  updateLabelSet,
} from "../services/mediaApi";
import { labelColor } from "../lib/mediaGeometry";
import { getErrorMessage } from "../services/getErrorMessage";
import {
  alertError,
  confirmAction,
  confirmDelete,
  toast,
} from "../lib/swal";

const QK = ["media", "labelSets"];

export default function MediaLabelSetsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: [...QK, includeInactive],
    queryFn: () => listLabelSets(includeInactive),
  });

  const labelSets = useMemo(() => data || [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return labelSets;
    return labelSets.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.labels?.some((l) => l.label?.toLowerCase().includes(q)),
    );
  }, [labelSets, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => updateLabelSet(id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (err) => alertError("Update failed", getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id) => deleteLabelSet(id),
    onSuccess: () => {
      toast("Label set deleted");
      invalidate();
    },
    onError: (err) => alertError("Delete failed", getErrorMessage(err)),
  });

  const handleToggle = async (s) => {
    const ok = await confirmAction(
      s.isActive ? `Deactivate "${s.name}"?` : `Activate "${s.name}"?`,
      s.isActive
        ? "It stays attached to any dataset using it, but will not be offered for new ones."
        : "It will become selectable again.",
      s.isActive ? "Deactivate" : "Activate",
    );
    if (!ok) return;
    setBusyId(s._id);
    toggleActive.mutate({ id: s._id, isActive: !s.isActive });
  };

  const handleDelete = async (s) => {
    const ok = await confirmDelete(
      `Delete "${s.name}"?`,
      "This cannot be undone. Any dataset still using it must be rebound first.",
    );
    if (!ok) return;
    setBusyId(s._id);
    remove.mutate(s._id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Tags className="w-4.5 h-4.5" />
            </div>
            Media Label Sets
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            The class vocabulary for image and video datasets. Each label's slug
            becomes its class name in every export.
          </p>
        </div>

        <button className="btn btn-primary btn-sm gap-2" onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" />
          New Label Set
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search label sets or classes…"
            className="input input-sm input-bordered w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <span className="label-text text-sm">Show inactive</span>
        </label>
      </div>

      {isLoading && <div className="skeleton h-28 w-full" />}

      {error && (
        <div className="alert alert-error text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{getErrorMessage(error)}</span>
        </div>
      )}

      {!isLoading && labelSets.length === 0 && (
        <div className="text-center py-16 border border-dashed border-base-content/15 rounded-box">
          <Tags className="w-10 h-10 mx-auto text-base-content/20 mb-3" />
          <p className="text-sm text-base-content/60">No label sets yet.</p>
          <button
            className="btn btn-primary btn-sm mt-4"
            onClick={() => setEditing("new")}
          >
            Create your first label set
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <LabelSetCard
              key={s._id}
              set={s}
              busy={busyId === s._id}
              onEdit={() => setEditing(s)}
              onToggle={() => handleToggle(s)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      )}

      {editing && (
        <LabelSetEditor
          labelSet={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function LabelSetCard({ set, busy, onEdit, onToggle, onDelete }) {
  return (
    <article
      className={`card bg-base-100 border border-base-content/5 ${set.isActive ? "" : "opacity-60"}`}
    >
      <div className="card-body p-5 gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold flex items-center gap-2">
              {set.name}
              {!set.isActive && (
                <span className="badge badge-ghost badge-xs">inactive</span>
              )}
            </h3>
            {set.description && (
              <p className="text-xs text-base-content/60 mt-0.5 line-clamp-2">
                {set.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              className="btn btn-ghost btn-xs"
              onClick={onToggle}
              disabled={busy}
              title={set.isActive ? "Deactivate" : "Activate"}
            >
              {set.isActive ? (
                <PowerOff className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
            </button>
            <button className="btn btn-ghost btn-xs" onClick={onEdit} title="Edit">
              <Tags className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn btn-ghost btn-xs text-error"
              onClick={onDelete}
              disabled={busy}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divider my-0" />

        <div className="flex flex-wrap gap-1.5">
          {(set.labels || []).map((l) => (
            <span
              key={l.value}
              className="badge badge-sm gap-1.5 border-base-content/10"
              style={{ backgroundColor: `${labelColor(l)}22`, color: l.color || undefined }}
              title={`Class name in exports: ${l.value}`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: labelColor(l) }}
              />
              {l.label}
            </span>
          ))}
          {(set.labels || []).length === 0 && (
            <span className="text-xs text-base-content/40 italic">no classes</span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

function LabelSetEditor({ labelSet, onClose, onSaved }) {
  const isEdit = Boolean(labelSet);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      name: labelSet?.name || "",
      description: labelSet?.description || "",
      labels: (labelSet?.labels || []).map((l) => ({ label: l.label })),
    },
  });

  const labels = useFieldArray({ control, name: "labels" });

  const onSubmit = async (values) => {
    setError(null);

    const name = values.name?.trim();
    if (!name) return setError("Name is required");

    const cleaned = (values.labels || [])
      .map((l) => String(l.label || "").trim())
      .filter(Boolean);
    if (cleaned.length === 0) return setError("At least one class is required");

    // The server slugs each label into a class name and rejects collisions.
    // Catching it here saves a round-trip and explains the actual problem.
    const slugs = cleaned.map((l) => slugify(l));
    if (slugs.some((s) => !s)) {
      return setError(`"${cleaned[slugs.findIndex((s) => !s)]}" has no letters or numbers`);
    }
    const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
    if (dupe) {
      return setError(`Two classes slug to "${dupe}" — they would be indistinguishable`);
    }

    setSaving(true);
    try {
      const payload = { name, description: values.description?.trim() || "", labels: cleaned };
      if (isEdit) await updateLabelSet(labelSet._id, payload);
      else await createLabelSet(payload);
      toast(isEdit ? "Label set updated" : "Label set created");
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-1">
          {isEdit ? "Edit label set" : "New label set"}
        </h3>
        <p className="text-xs text-base-content/60 mb-4">
          Each class is slugged into the name used by COCO and YOLO. Once a
          dataset has annotations, its label set is locked — add classes to a
          new set instead of changing this one.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1.5">Name</span>
              <input
                className="input input-sm input-bordered w-full"
                placeholder="Road Signs"
                {...register("name")}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1.5">
                Description
              </span>
              <input
                className="input input-sm input-bordered w-full"
                placeholder="Optional"
                {...register("description")}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label-text text-xs font-semibold">Classes</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => labels.append({ label: "" })}
              >
                <Plus className="w-3 h-3" />
                Add class
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {labels.fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: labelColor({ value: `k${i}` }) }}
                  />
                  <input
                    className="input input-sm input-bordered flex-1"
                    placeholder={`Class ${i + 1}`}
                    {...register(`labels.${i}.label`)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => labels.remove(i)}
                    disabled={labels.fields.length === 1}
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

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
            <button
              type="submit"
              className="btn btn-primary btn-sm gap-2"
              disabled={saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isEdit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
      <button className="modal-backdrop" onClick={onClose} type="button" aria-label="Close" />
    </div>
  );
}

/** Mirrors the server's slugify closely enough to catch collisions early. */
function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}
