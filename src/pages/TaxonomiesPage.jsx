// src/pages/TaxonomiesPage.jsx
import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Check,
  Power,
  PowerOff,
  Search,
  ListPlus,
  Type as TypeIcon,
  Heart,
} from "lucide-react";

import {
  listTaxonomies,
  createTaxonomy,
  updateTaxonomy,
  deleteTaxonomy,
} from "../services/taxonomyApi";

import {
  toast,
  alertError,
  alertSuccess,
  confirmAction,
  confirmDelete,
} from "../lib/swal";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TaxonomiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // taxonomy object OR "new"
  const [busyId, setBusyId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["taxonomies"],
    queryFn: () => listTaxonomies(),
  });

  // Stable reference — prevents useMemo from re-running every render
  // when `data` is undefined.
  const taxonomies = useMemo(() => data?.taxonomies || [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taxonomies;
    return taxonomies.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [taxonomies, search]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["taxonomies"] });

  const handleToggleActive = async (t) => {
    const ok = await confirmAction(
      t.isActive ? `Deactivate "${t.name}"?` : `Activate "${t.name}"?`,
      t.isActive
        ? "Annotators will no longer see this taxonomy when it's unassigned from datasets in use."
        : "This taxonomy will become selectable again.",
      t.isActive ? "Deactivate" : "Activate",
    );
    if (!ok) return;

    setBusyId(t._id);
    try {
      await updateTaxonomy(t._id, { isActive: !t.isActive });
      toast(t.isActive ? "Deactivated" : "Activated");
      invalidate();
    } catch (err) {
      alertError(
        "Update failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (t) => {
    const ok = await confirmDelete(
      `Delete "${t.name}"?`,
      "Soft-delete by default. Datasets assigned to it will keep working until unassigned.",
    );
    if (!ok) return;

    setBusyId(t._id);
    try {
      await deleteTaxonomy(t._id, false);
      toast("Taxonomy deactivated");
      invalidate();
    } catch (err) {
      alertError(
        "Delete failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Tags className="w-4.5 h-4.5" />
            </div>
            Taxonomies
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Define custom sentiment & language label sets and assign them to
            datasets.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm gap-2"
          onClick={() => setEditing("new")}
        >
          <Plus className="w-4 h-4" />
          New Taxonomy
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Search taxonomies…"
          className="input input-sm input-bordered w-full pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Body */}
      {isLoading && <TaxonomyListSkeleton rows={4} />}

      {error && (
        <div className="alert alert-error text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error.message}</span>
        </div>
      )}

      {!isLoading && taxonomies.length === 0 && (
        <EmptyState onCreate={() => setEditing("new")} />
      )}

      {!isLoading && taxonomies.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-base-content/60 text-sm">
          No taxonomies match "{search}".
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <TaxonomyCard
              key={t._id}
              taxonomy={t}
              busy={busyId === t._id}
              onEdit={() => setEditing(t)}
              onToggle={() => handleToggleActive(t)}
              onDelete={() => handleDelete(t)}
            />
          ))}
        </div>
      )}

      {editing && (
        <TaxonomyEditorModal
          taxonomy={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            alertSuccess("Saved", "Taxonomy updated.");
            invalidate();
          }}
          onError={(msg) => alertError("Save failed", msg)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function TaxonomyCard({ taxonomy: t, busy, onEdit, onToggle, onDelete }) {
  return (
    <article className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{t.name}</h3>
              {!t.isActive && (
                <span className="badge badge-ghost badge-xs">inactive</span>
              )}
            </div>
            {t.description && (
              <p className="text-xs text-base-content/60 mt-0.5 truncate">
                {t.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className="btn btn-ghost btn-xs btn-square"
              onClick={onEdit}
              disabled={busy}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn btn-ghost btn-xs btn-square"
              onClick={onToggle}
              disabled={busy}
              title={t.isActive ? "Deactivate" : "Activate"}
            >
              {busy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : t.isActive ? (
                <PowerOff className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10"
              onClick={onDelete}
              disabled={busy}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divider my-1"></div>

        <div className="space-y-3">
          <LabelGroup
            icon={Heart}
            label="Sentiment"
            items={t.sentiment || []}
            color="primary"
          />
          <LabelGroup
            icon={TypeIcon}
            label="Type / Language"
            items={t.type || []}
            color="secondary"
          />
        </div>
      </div>
    </article>
  );
}

function LabelGroup({ icon: Icon, label, items, color }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 text-${color}`} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-base-content/60">
          {label}
        </span>
        <span className="text-[10px] text-base-content/40">
          ({items.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span
            key={it.value}
            className="badge badge-sm badge-ghost gap-1"
            title={`value: ${it.value}`}
          >
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor modal                                                        */
/* ------------------------------------------------------------------ */

function TaxonomyEditorModal({ taxonomy, onClose, onSaved, onError }) {
  const isEdit = !!taxonomy;
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: taxonomy?.name || "",
      description: taxonomy?.description || "",
      sentiment: taxonomy?.sentiment?.map((s) => ({
        label: s.label,
        value: s.value,
      })) || [
        { label: "Positive", value: "positive" },
        { label: "Negative", value: "negative" },
        { label: "Neutral", value: "neutral" },
      ],
      type: taxonomy?.type?.map((t) => ({
        label: t.label,
        value: t.value,
      })) || [
        { label: "Bangla", value: "bangla" },
        { label: "English", value: "english" },
        { label: "Banglish", value: "banglish" },
      ],
    },
  });

  const sentimentArray = useFieldArray({ control, name: "sentiment" });
  const typeArray = useFieldArray({ control, name: "type" });

  const onSubmit = async (values) => {
    // Normalize: strip empty rows
    const sentiment = (values.sentiment || []).filter(
      (s) => s.label?.trim() || s.value?.trim(),
    );
    const type = (values.type || []).filter(
      (t) => t.label?.trim() || t.value?.trim(),
    );

    if (!values.name.trim()) {
      onError("Name is required");
      return;
    }
    if (sentiment.length === 0) {
      onError("At least one sentiment option is required");
      return;
    }
    if (type.length === 0) {
      onError("At least one type/language option is required");
      return;
    }

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || "",
      sentiment: sentiment.map((s, i) => ({
        value: (s.value || s.label).trim(),
        label: s.label.trim(),
        order: i,
      })),
      type: type.map((t, i) => ({
        value: (t.value || t.label).trim(),
        label: t.label.trim(),
        order: i,
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateTaxonomy(taxonomy._id, payload);
      } else {
        await createTaxonomy(payload);
      }
      onSaved();
    } catch (err) {
      onError(err?.response?.data?.error || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-base-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">
                {isEdit ? "Edit taxonomy" : "New taxonomy"}
              </h3>
              <p className="text-xs text-base-content/50">
                Define the label sets annotators will pick from.
              </p>
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Body */}
          <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
            {/* Name */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                  Name
                </span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full ${
                  errors.name ? "input-error" : ""
                }`}
                placeholder="e.g. Product Review Labels"
                autoFocus
                maxLength={120}
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-error text-xs mt-1.5">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                  Description (optional)
                </span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="What is this taxonomy for?"
                maxLength={500}
                {...register("description")}
              />
            </div>

            <div className="divider my-1"></div>

            {/* Sentiment items */}
            <FieldList
              title="Sentiment options"
              hint="One per row. Label is what annotators see; value is what's stored."
              array={sentimentArray}
              register={register}
              fieldPrefix="sentiment"
              color="primary"
              placeholderLabel="e.g. Positive"
              placeholderValue="positive"
            />

            {/* Type items */}
            <FieldList
              title="Type / Language options"
              hint="Same as above — add as many as you need."
              array={typeArray}
              register={register}
              fieldPrefix="type"
              color="secondary"
              placeholderLabel="e.g. Bangla"
              placeholderValue="bangla"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 p-5 border-t border-base-200 bg-base-200/40">
            <p className="text-xs text-base-content/50">
              {isEdit
                ? "Changes apply to datasets currently using this taxonomy."
                : "You can assign this taxonomy to a dataset from its detail page."}
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={saving}
              >
                {saving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isEdit ? "Save changes" : "Create taxonomy"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div
        className="modal-backdrop"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Renders a dynamic list of { label, value } rows bound to a
 * useFieldArray. The `fieldPrefix` prop tells it which array to
 * register against ("sentiment" or "type") — replacing the previous
 * title-string sniffing which was fragile and produced the ESLint
 * "constant truthiness" warning.
 */
function FieldList({
  title,
  hint,
  array,
  register,
  fieldPrefix,
  color,
  placeholderLabel,
  placeholderValue,
}) {
  const { fields, append, remove } = array;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ListPlus className={`w-3.5 h-3.5 text-${color}`} />
          <span className="text-sm font-semibold">{title}</span>
          <span className="badge badge-xs badge-ghost">{fields.length}</span>
        </div>
        <button
          type="button"
          className="btn btn-xs btn-ghost gap-1"
          onClick={() => append({ label: "", value: "" })}
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
      <p className="text-xs text-base-content/50 mb-2">{hint}</p>

      <div className="space-y-1.5">
        {fields.map((f, i) => (
          <div key={f.id} className="flex items-center gap-1.5">
            <input
              type="text"
              className="input input-bordered input-sm flex-1 min-w-0"
              placeholder={`Label — ${placeholderLabel}`}
              {...register(`${fieldPrefix}.${i}.label`)}
            />
            <input
              type="text"
              className="input input-bordered input-sm flex-1 min-w-0 font-mono text-xs"
              placeholder={`value — ${placeholderValue}`}
              {...register(`${fieldPrefix}.${i}.value`)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 shrink-0"
              onClick={() => remove(i)}
              disabled={fields.length <= 1}
              title="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty & skeleton                                                    */
/* ------------------------------------------------------------------ */

function EmptyState({ onCreate }) {
  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body items-center text-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <Tags className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold">No taxonomies yet</h2>
        <p className="text-sm text-base-content/60 mt-1 max-w-sm">
          Create a taxonomy to define custom sentiment and language options,
          then assign it to any dataset.
        </p>
        <button className="btn btn-primary gap-2 mt-5" onClick={onCreate}>
          <Plus className="w-4 h-4" />
          Create your first taxonomy
        </button>
      </div>
    </div>
  );
}

function TaxonomyListSkeleton({ rows = 4 }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="card bg-base-100 border border-base-200 shadow-sm"
        >
          <div className="card-body p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-56" />
              </div>
              <div className="flex gap-1">
                <div className="skeleton w-7 h-7 rounded" />
                <div className="skeleton w-7 h-7 rounded" />
                <div className="skeleton w-7 h-7 rounded" />
              </div>
            </div>
            <div className="divider my-1"></div>
            <div className="skeleton h-4 w-24" />
            <div className="flex gap-1">
              <div className="skeleton h-6 w-16 rounded-full" />
              <div className="skeleton h-6 w-20 rounded-full" />
              <div className="skeleton h-6 w-14 rounded-full" />
            </div>
            <div className="skeleton h-4 w-24" />
            <div className="flex gap-1">
              <div className="skeleton h-6 w-16 rounded-full" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
