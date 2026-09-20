// src/pages/DatasetDetailPage.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  Save,
  Trash2,
  Search,
  CheckCircle2,
  History,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
  CheckSquare,
  Square,
  Clock,
  User,
  Tags as TagsIcon,
  ListChecks,
} from "lucide-react";

import {
  listComments,
  annotateComment,
  deleteComment,
  getCommentVersions,
  restoreCommentVersion,
  bulkAnnotateComments,
} from "../services/commentApi";
import { listUsers } from "../services/userApi";
import { getDataset, assignDataset } from "../services/datasetApi";
import {
  listTaxonomies,
  assignTaxonomyToDataset,
  unassignTaxonomyFromDataset,
} from "../services/taxonomyApi";

import { useAuth } from "../context/useAuth";
import { useDatasetTaxonomy } from "../hooks/useDatasetTaxonomy";
import { toast, alertError, confirmAction, confirmDelete } from "../lib/swal";
import { getDatasetDisplayStatus } from "../lib/datasetStatus";

const PAGE_SIZES = [5, 10, 20, 25, 50, 100, 200];

// Shared frozen-in-practice empty selection, reused when the active filter
// signature changed (members are never mutated in place).
const EMPTY_IDS = new Set();

export default function DatasetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  // Pagination + filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [hideAnnotated, setHideAnnotated] = useState(true);
  const [historyCommentId, setHistoryCommentId] = useState(null);

  // Row-level unsaved changes
  const [rows, setRows] = useState({});

  // Bulk selection + state — scoped to the filter signature it was made under
  const filtersKey = [page, pageSize, filterStatus, search, hideAnnotated].join(
    "|",
  );
  const [selection, setSelection] = useState(() => ({
    key: null,
    ids: new Set(),
  }));
  const [bulkBusy, setBulkBusy] = useState(false);

  const [bulkSentiment, setBulkSentiment] = useState("");
  const [bulkType, setBulkType] = useState("");

  const listTopRef = useRef(null);

  const selectedIds = selection.key === filtersKey ? selection.ids : EMPTY_IDS;

  const updateSelection = (updater) => {
    setSelection((prev) => ({
      key: filtersKey,
      ids: updater(prev.key === filtersKey ? prev.ids : EMPTY_IDS),
    }));
  };

  /* ---------------------------------------------------------------- */
  /* Data                                                              */
  /* ---------------------------------------------------------------- */

  const { data: dsData, isLoading: loadingDs } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => getDataset(id),
    enabled: !!id,
  });

  const dataset = dsData?.dataset;
  const summary = dsData?.summary || { total: 0, pending: 0, annotated: 0 };

  const progressPct =
    summary.total > 0
      ? Math.round((summary.annotated / summary.total) * 100)
      : 0;

  const displayStatus = getDatasetDisplayStatus(dataset, summary);

  // Effective taxonomy (sentiment/type options) for this dataset
  const taxonomy = useDatasetTaxonomy(id);

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const annotators = (usersData?.users || []).filter(
    (u) => u.role === "annotator",
  );

  const assigneeName = () => {
    if (!dataset?.assignedTo) return "Unassigned";
    const u = annotators.find((x) => x._id === dataset.assignedTo);
    return u ? u.name : "(removed)";
  };

  const params = {
    datasetId: id,
    page,
    limit: pageSize,
    ...(filterStatus && { status: filterStatus }),
    ...(!filterStatus && hideAnnotated && { hideAnnotated: "true" }),
    ...(search && { search }),
  };

  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ["comments", params],
    queryFn: () => listComments(params),
    enabled: !!id,
  });

  const comments = commentsData?.comments || [];
  const total = commentsData?.total || 0;
  const totalPages = commentsData?.totalPages || 1;

  /* ---------------------------------------------------------------- */
  /* Row helpers                                                       */
  /* ---------------------------------------------------------------- */

  const setRow = (commentId, patch) => {
    setRows((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], ...patch },
    }));
  };

  const resolveRow = (c) => {
    const local = rows[c._id] || {};
    const sentimentValues = taxonomy.values.sentiment;
    const typeValues = taxonomy.values.type;
    return {
      sentiment:
        local.sentiment ??
        (sentimentValues.includes(c.sentiment) ? c.sentiment : ""),
      type: local.type ?? (typeValues.includes(c.type) ? c.type : ""),
    };
  };

  const clearRow = (commentId) => {
    setRows((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const dirtyCount = Object.keys(rows).length;

  const handleSave = async (comment) => {
    const row = resolveRow(comment);

    if (!row.sentiment || !row.type) {
      toast("Pick both sentiment and type", "warning");
      return;
    }

    const serverSentiment = taxonomy.values.sentiment.includes(
      comment.sentiment,
    )
      ? comment.sentiment
      : "";
    const serverType = taxonomy.values.type.includes(comment.type)
      ? comment.type
      : "";

    if (row.sentiment === serverSentiment && row.type === serverType) {
      return;
    }

    try {
      await annotateComment(comment._id, {
        sentiment: row.sentiment,
        type: row.type,
      });
      clearRow(comment._id);
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    } catch (err) {
      clearRow(comment._id);
      alertError(
        "Save failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    }
  };

  const handleAssign = async (assignedTo) => {
    try {
      await assignDataset(id, assignedTo);
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    } catch (err) {
      alertError(
        "Assign failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    }
  };

  const handleDelete = async (commentId) => {
    const ok = await confirmDelete(
      "Delete this comment?",
      "All its versions will also be removed. This cannot be undone.",
    );
    if (!ok) return;

    try {
      await deleteComment(commentId);
      updateSelection((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
    } catch (err) {
      alertError(
        "Delete failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };

  const goToPage = (p) => {
    if (p === page) return;
    setPage(p);
    if (listTopRef.current) {
      const yOffset = -140;
      const y =
        listTopRef.current.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  /* ---------------------------------------------------------------- */
  /* Bulk selection                                                    */
  /* ---------------------------------------------------------------- */

  const allOnPageSelected =
    comments.length > 0 && comments.every((c) => selectedIds.has(c._id));

  const someOnPageSelected =
    !allOnPageSelected && comments.some((c) => selectedIds.has(c._id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      updateSelection((prev) => {
        const next = new Set(prev);
        comments.forEach((c) => next.delete(c._id));
        return next;
      });
    } else {
      updateSelection((prev) => {
        const next = new Set(prev);
        comments.forEach((c) => next.add(c._id));
        return next;
      });
    }
  };

  const toggleSelected = (commentId) => {
    updateSelection((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const clearSelection = () => {
    updateSelection(() => new Set());
    setBulkSentiment("");
    setBulkType("");
  };

  /* ---------------------------------------------------------------- */
  /* Bulk actions                                                      */
  /* ---------------------------------------------------------------- */

  const hasBulkDraft = Boolean(bulkSentiment || bulkType);

  const handleBulkAnnotate = async (patch) => {
    if (selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await bulkAnnotateComments({
        ids: Array.from(selectedIds),
        ...patch,
      });
      toast(`Updated ${res.updated} of ${res.requested}`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
    } catch (err) {
      alertError(
        "Bulk update failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkSubmit = (e) => {
    e.preventDefault();
    if (!hasBulkDraft || bulkBusy) return;

    const patch = {};
    if (bulkSentiment) patch.sentiment = bulkSentiment;
    if (bulkType) patch.type = bulkType;

    handleBulkAnnotate(patch);
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (loadingDs) {
    return <DatasetDetailSkeleton isAdmin={isAdmin} />;
  }

  if (!dataset) {
    return (
      <div className="text-center py-10">
        <p className="text-base-content/60 mb-4">Dataset not found.</p>
        <Link to="/datasets" className="btn btn-primary">
          Back to Datasets
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* ---------- Header ---------- */}
      <div className="mb-4">
        <Link
          to="/datasets"
          className="text-xs link link-hover mb-1 inline-flex items-center gap-1 text-base-content/60"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Datasets
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {dataset.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-base-content/60 flex-wrap">
              <span className="truncate">{dataset.originalFileName}</span>
              <span className="text-base-content/20">·</span>
              <span className="flex items-center gap-1 shrink-0">
                <User className="w-3 h-3" />
                {isAdmin ? assigneeName() : "You"}
              </span>
              {isAdmin && (
                <AssignDropdown
                  annotators={annotators}
                  assignedTo={dataset.assignedTo}
                  onAssign={handleAssign}
                />
              )}

              <span className="text-base-content/20">·</span>

              {isAdmin ? (
                <DatasetTaxonomyPicker
                  datasetId={id}
                  currentTaxonomyId={dataset.taxonomyId || null}
                  currentTaxonomyName={dataset.taxonomyName || null}
                  onChanged={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["dataset", id],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["taxonomy-for-dataset", id],
                    });
                  }}
                />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-base-content/60">
                  <TagsIcon className="w-3 h-3" />
                  {dataset.taxonomyName || "Default labels"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Sticky: progress strip + toolbar ---------- */}
      <div className="sticky top-16 z-20 -mx-3 px-3 pb-2 bg-base-200/80 backdrop-blur">
        {/* Progress strip */}
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="px-3 sm:px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={`text-xl sm:text-2xl font-bold tabular-nums leading-none shrink-0 ${
                  progressPct === 100 ? "text-success" : "text-base-content"
                }`}
              >
                {progressPct}%
              </span>

              <div className="flex-1 min-w-0">
                <progress
                  className={`progress w-full h-1.5 ${
                    progressPct === 100
                      ? "progress-success"
                      : "progress-primary"
                  }`}
                  value={summary.annotated}
                  max={summary.total || 1}
                />
                <div className="flex items-center justify-between text-[11px] text-base-content/50 mt-1">
                  <span className="truncate">
                    {summary.annotated.toLocaleString()} of{" "}
                    {summary.total.toLocaleString()} annotated
                  </span>
                  <span className="shrink-0 ml-2">
                    {summary.pending > 0 ? (
                      <>{summary.pending.toLocaleString()} pending</>
                    ) : (
                      <span className="text-success font-medium">All done</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {dirtyCount > 0 && (
                  <span className="badge badge-warning badge-sm gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {dirtyCount}
                  </span>
                )}
                <StatusChip status={displayStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="card bg-base-100 border border-base-200 shadow-sm mt-1.5">
          <div className="px-3 py-2 flex flex-wrap items-center gap-2">
            {/* Filter pills */}
            <div className="flex items-center gap-0.5">
              <FilterPill
                active={filterStatus === "" && hideAnnotated}
                label="To do"
                onClick={() => {
                  setFilterStatus("");
                  setHideAnnotated(true);
                  setPage(1);
                }}
              />
              <FilterPill
                active={filterStatus === "" && !hideAnnotated}
                label="All"
                onClick={() => {
                  setFilterStatus("");
                  setHideAnnotated(false);
                  setPage(1);
                }}
              />
              <FilterPill
                active={filterStatus === "pending"}
                label="Pending"
                onClick={() => {
                  setFilterStatus("pending");
                  setPage(1);
                }}
              />
              <FilterPill
                active={filterStatus === "annotated"}
                label="Done"
                onClick={() => {
                  setFilterStatus("annotated");
                  setPage(1);
                }}
              />
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-base-content/50 pl-2 ml-1 border-l border-base-200">
              <strong className="text-base-content">
                {total.toLocaleString()}
              </strong>
              comment{total === 1 ? "" : "s"}
            </span>

            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              className="join w-full sm:w-auto sm:ml-auto order-3 sm:order-2"
            >
              <label className="input input-bordered input-xs join-item flex items-center gap-1.5 flex-1 sm:w-56">
                <Search className="w-3 h-3 text-base-content/40" />
                <input
                  type="text"
                  className="grow text-xs"
                  placeholder="Search text…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle -mr-1"
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Clear search"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </label>
              <button className="btn btn-xs join-item" type="submit">
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      <div ref={listTopRef} className="mt-2" />

      {/* ---------- Comments table ---------- */}
      <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        {loadingComments ? (
          <CommentsTableSkeleton rows={Math.min(pageSize, 10)} />
        ) : comments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ListFilter className="w-10 h-10 mx-auto text-base-content/30 mb-3" />
            <p className="font-medium">No comments found</p>
            <p className="text-sm text-base-content/60 mt-1">
              {total === 0
                ? "This dataset has no comments yet."
                : "Try adjusting your filters or search."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table table-xs table-pin-rows table-fixed w-full">
                <thead className="bg-base-200/50 text-[10px] uppercase tracking-wider text-base-content/50">
                  <tr>
                    <th className="w-8 px-2!">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={toggleSelectAllOnPage}
                        title={
                          allOnPageSelected
                            ? "Deselect all on page"
                            : "Select all on page"
                        }
                        aria-label="Toggle select all"
                      >
                        {allOnPageSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        ) : someOnPageSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-base-content/40" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-base-content/40" />
                        )}
                      </button>
                    </th>
                    <th className="w-20">ID</th>
                    <th>Comment</th>
                    <th className="w-32">Sentiment</th>
                    <th className="w-32">Type</th>
                    <th className="w-24">Status</th>
                    <th className="w-28 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((c) => (
                    <CommentTableRow
                      key={c._id}
                      comment={c}
                      isAdmin={isAdmin}
                      row={resolveRow(c)}
                      setRow={setRow}
                      onSave={handleSave}
                      onDelete={handleDelete}
                      onHistory={setHistoryCommentId}
                      selected={selectedIds.has(c._id)}
                      onToggleSelect={toggleSelected}
                      sentimentOptions={taxonomy.sentiment}
                      typeOptions={taxonomy.type}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-base-200 bg-base-200/30 px-3 py-2">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={goToPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </>
        )}
      </div>

      {/* ---------- Bulk actions floating bar ---------- */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]">
          <form
            onSubmit={handleBulkSubmit}
            className="bg-base-100 rounded-xl shadow-2xl border border-base-200 p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="flex items-center gap-2 sm:pr-3 sm:border-r border-base-200">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={clearSelection}
                disabled={bulkBusy}
                aria-label="Clear selection"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <select
                className="select select-bordered select-xs flex-1 min-w-0"
                value={bulkSentiment}
                onChange={(e) => setBulkSentiment(e.target.value)}
                disabled={bulkBusy || taxonomy.isLoading}
                aria-label="Sentiment to apply"
              >
                <option value="">Sentiment…</option>
                {taxonomy.sentiment.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                className="select select-bordered select-xs flex-1 min-w-0"
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value)}
                disabled={bulkBusy || taxonomy.isLoading}
                aria-label="Type to apply"
              >
                <option value="">Type…</option>
                {taxonomy.type.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="btn btn-xs btn-primary gap-1.5 shrink-0"
                disabled={bulkBusy || !hasBulkDraft}
              >
                {bulkBusy ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Apply
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History modal */}
      {historyCommentId && (
        <HistoryModal
          commentId={historyCommentId}
          datasetId={id}
          onClose={() => setHistoryCommentId(null)}
          onRestored={(msg) => toast(msg)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter pill                                                         */
/* ------------------------------------------------------------------ */

function FilterPill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-xs rounded-full normal-case font-normal ${
        active ? "btn-primary" : "btn-ghost"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Status chip                                                         */
/* ------------------------------------------------------------------ */

function StatusChip({ status }) {
  const map = {
    importing: { label: "Importing", cls: "badge-info", spin: true },
    failed: { label: "Failed", cls: "badge-error" },
    complete: { label: "Complete", cls: "badge-success" },
    in_progress: { label: "In progress", cls: "badge-primary" },
    ready: { label: "Ready", cls: "badge-warning" },
    unassigned: { label: "Unassigned", cls: "badge-ghost" },
    empty: { label: "Empty", cls: "badge-ghost" },
  };
  const info = map[status] || map.empty;
  return (
    <span className={`badge badge-sm gap-1 ${info.cls} shrink-0`}>
      {info.spin && (
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      {info.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Comment table row                                                   */
/* ------------------------------------------------------------------ */

function CommentTableRow({
  comment,
  isAdmin,
  row,
  setRow,
  onSave,
  onDelete,
  onHistory,
  selected,
  onToggleSelect,
  sentimentOptions,
  typeOptions,
}) {
  const sentimentValues = sentimentOptions.map((s) => s.value);
  const typeValues = typeOptions.map((t) => t.value);

  const serverSentiment = sentimentValues.includes(comment.sentiment)
    ? comment.sentiment
    : "";
  const serverType = typeValues.includes(comment.type) ? comment.type : "";
  const dirty = row.sentiment !== serverSentiment || row.type !== serverType;
  const canSave = dirty && !!row.sentiment && !!row.type;
  const isDone = comment.status === "annotated";

  return (
    <tr
      className={`group transition-colors ${
        selected
          ? "bg-primary/5"
          : dirty
            ? "bg-warning/10"
            : isDone
              ? "bg-success/3"
              : ""
      }`}
    >
      {/* Checkbox */}
      <td className="px-2! align-middle">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => onToggleSelect(comment._id)}
          aria-label={selected ? "Deselect comment" : "Select comment"}
        >
          {selected ? (
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Square className="w-3.5 h-3.5 text-base-content/40" />
          )}
        </button>
      </td>

      {/* ID */}
      <td className="align-middle">
        <span
          className="font-mono text-[11px] text-base-content/60 truncate block max-w-20"
          title={comment.sourceId}
        >
          {comment.sourceId}
        </span>
      </td>

      {/* Comment text */}
      <td className="align-middle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm truncate block" title={comment.commentText}>
            {comment.commentText}
          </span>
          {dirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-warning shrink-0"
              title="Unsaved changes"
            />
          )}
        </div>
      </td>

      {/* Sentiment */}
      <td className="align-middle">
        <select
          className={`select select-bordered select-xs w-full ${
            dirty && !row.sentiment ? "select-warning" : ""
          }`}
          value={row.sentiment}
          onChange={(e) => setRow(comment._id, { sentiment: e.target.value })}
          aria-label="Sentiment"
        >
          <option value="">—</option>
          {sentimentOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </td>

      {/* Type */}
      <td className="align-middle">
        <select
          className={`select select-bordered select-xs w-full ${
            dirty && !row.type ? "select-warning" : ""
          }`}
          value={row.type}
          onChange={(e) => setRow(comment._id, { type: e.target.value })}
          aria-label="Type"
        >
          <option value="">—</option>
          {typeOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </td>

      {/* Status */}
      <td className="align-middle">
        {isDone ? (
          <span className="badge badge-xs badge-success gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Done
          </span>
        ) : (
          <span className="badge badge-xs badge-warning gap-1">
            <Clock className="w-2.5 h-2.5" />
            Pending
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="align-middle text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-0.5">
          <button
            className={`btn btn-xs gap-1 transition-opacity ${
              canSave
                ? "btn-primary opacity-100"
                : "btn-ghost opacity-30 pointer-events-none"
            }`}
            onClick={() => onSave(comment)}
            disabled={!canSave}
            title={canSave ? "Save changes" : "No changes"}
            aria-label="Save"
          >
            <Save className="w-3 h-3" />
            Save
          </button>

          {isAdmin && (
            <>
              <button
                className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => onHistory(comment._id)}
                title="Version history"
                aria-label="Version history"
              >
                <History className="w-3 h-3" />
              </button>
              <button
                className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => onDelete(comment._id)}
                title="Delete comment"
                aria-label="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination bar                                                      */
/* ------------------------------------------------------------------ */

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const pageNumbers = (() => {
    const pages = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");

    pages.push(totalPages);
    return pages;
  })();

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-3 text-xs text-base-content/60 order-2 sm:order-1">
        <span className="tabular-nums whitespace-nowrap">
          <strong className="text-base-content">{from}</strong>–
          <strong className="text-base-content">{to}</strong> of{" "}
          <strong className="text-base-content">
            {totalItems.toLocaleString()}
          </strong>
        </span>

        <div className="hidden sm:flex items-center gap-1.5 ml-2">
          <span className="whitespace-nowrap">Rows</span>
          <select
            className="select select-bordered select-xs w-16"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1 justify-center sm:justify-end order-1 sm:order-2">
        <button
          className="btn btn-xs btn-ghost btn-square"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          className="btn btn-xs btn-ghost btn-square"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="hidden sm:flex items-center gap-0.5 mx-1">
          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="w-6 text-center text-xs text-base-content/40 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`btn btn-xs min-w-7 px-1.5 normal-case font-normal tabular-nums ${
                  p === currentPage ? "btn-primary" : "btn-ghost"
                }`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <span className="sm:hidden px-2 text-xs tabular-nums">
          <strong>{currentPage}</strong>
          <span className="text-base-content/40"> / {totalPages}</span>
        </span>

        <button
          className="btn btn-xs btn-ghost btn-square"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          className="btn btn-xs btn-ghost btn-square"
          disabled={isLast}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assign dropdown (portal)                                            */
/* ------------------------------------------------------------------ */

function AssignDropdown({ annotators, assignedTo, onAssign }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12;
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );

    setMenuStyle(
      openUp
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + 6,
            left,
            width: menuWidth,
            zIndex: 9999,
          }
        : {
            position: "fixed",
            top: rect.bottom + 6,
            left,
            width: menuWidth,
            zIndex: 9999,
          },
    );
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        className="btn btn-ghost btn-xs gap-1 normal-case shrink-0"
        onClick={toggle}
      >
        <UserPlus className="w-3 h-3" />
        {assignedTo ? "Reassign" : "Assign"}
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="menu bg-base-100 rounded-box p-2 shadow-lg border border-base-200"
          >
            <div className="menu-title text-xs px-3 pt-1">Assign to</div>
            <div className="max-h-52 overflow-y-auto">
              {annotators.length === 0 && (
                <div className="px-3 py-2 text-sm opacity-50">
                  No annotators
                </div>
              )}
              {annotators.map((u) => {
                const isCurrent = assignedTo === u._id;
                return (
                  <button
                    key={u._id}
                    disabled={isCurrent}
                    onClick={() => {
                      setOpen(false);
                      onAssign(u._id);
                    }}
                    className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded text-left text-sm ${
                      isCurrent
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-base-200"
                    }`}
                  >
                    <span className="truncate">{u.name}</span>
                    {isCurrent && (
                      <span className="badge badge-xs badge-primary shrink-0">
                        current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {assignedTo && (
              <>
                <div className="divider my-1"></div>
                <button
                  onClick={() => {
                    setOpen(false);
                    onAssign(null);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm text-error hover:bg-error/10"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Unassign
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dataset taxonomy picker (portal)                                    */
/* ------------------------------------------------------------------ */

function DatasetTaxonomyPicker({
  datasetId,
  currentTaxonomyId,
  currentTaxonomyName,
  onChanged,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const { data } = useQuery({
    queryKey: ["taxonomies"],
    queryFn: () => listTaxonomies({ isActive: true }),
    staleTime: 60 * 1000,
  });

  const taxonomies = data?.taxonomies || [];

  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 256;
    const menuHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12;
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );

    setMenuStyle(
      openUp
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + 6,
            left,
            width: menuWidth,
            zIndex: 9999,
          }
        : {
            position: "fixed",
            top: rect.bottom + 6,
            left,
            width: menuWidth,
            zIndex: 9999,
          },
    );
    setOpen(true);
  };

  const pick = async (taxonomyId) => {
    setOpen(false);
    setBusy(true);
    try {
      if (taxonomyId === null) {
        if (!currentTaxonomyId) {
          setBusy(false);
          return;
        }
        await unassignTaxonomyFromDataset(currentTaxonomyId, datasetId);
        toast("Switched to default labels");
      } else {
        if (taxonomyId === currentTaxonomyId) {
          setBusy(false);
          return;
        }
        await assignTaxonomyToDataset(taxonomyId, datasetId);
        toast("Taxonomy assigned");
      }
      onChanged();
    } catch (err) {
      alertError(
        "Update failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  };

  const label = currentTaxonomyName || "Default labels";

  return (
    <>
      <button
        ref={btnRef}
        className="btn btn-ghost btn-xs gap-1 normal-case shrink-0 text-base-content/70"
        onClick={toggle}
        disabled={busy}
        title="Assign taxonomy"
      >
        {busy ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <TagsIcon className="w-3 h-3" />
        )}
        {label}
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="menu bg-base-100 rounded-box p-2 shadow-lg border border-base-200"
          >
            <div className="menu-title text-xs px-3 pt-1">Assign taxonomy</div>

            <div className="max-h-56 overflow-y-auto">
              <button
                onClick={() => pick(null)}
                className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded text-left text-sm ${
                  !currentTaxonomyId
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-base-200"
                }`}
              >
                <span className="truncate italic">Default labels</span>
                {!currentTaxonomyId && (
                  <span className="badge badge-xs badge-primary shrink-0">
                    current
                  </span>
                )}
              </button>

              {taxonomies.length === 0 && (
                <div className="px-3 py-2 text-xs text-base-content/50">
                  No taxonomies yet
                </div>
              )}

              {taxonomies.map((t) => {
                const isCurrent = currentTaxonomyId === t._id;
                return (
                  <button
                    key={t._id}
                    onClick={() => pick(t._id)}
                    className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded text-left text-sm ${
                      isCurrent
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-base-200"
                    }`}
                    title={t.description || t.name}
                  >
                    <span className="truncate">{t.name}</span>
                    {isCurrent && (
                      <span className="badge badge-xs badge-primary shrink-0">
                        current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="divider my-1"></div>

            <Link
              to="/taxonomies"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm hover:bg-base-200 text-base-content/70"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Manage taxonomies
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function DatasetDetailSkeleton() {
  return (
    <div className="pb-24">
      <div className="mb-4 space-y-2">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-6 w-64" />
        <div className="skeleton h-3 w-48" />
      </div>

      <div className="sticky top-16 z-20 -mx-3 px-3 pb-2 bg-base-200/80 backdrop-blur">
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="px-4 py-2.5 flex items-center gap-3">
            <div className="skeleton h-7 w-14" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-1.5 w-full rounded-full" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="card bg-base-100 border border-base-200 shadow-sm mt-1.5">
          <div className="px-3 py-2 flex flex-wrap gap-2">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
            <div className="skeleton h-6 w-48 ml-auto" />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-200 shadow-sm mt-2">
        <CommentsTableSkeleton rows={8} />
      </div>
    </div>
  );
}

function CommentsTableSkeleton({ rows = 8 }) {
  return (
    <div className="overflow-hidden">
      <table className="table table-xs">
        <thead className="bg-base-200/50 text-[10px] uppercase tracking-wider text-base-content/50">
          <tr>
            <th className="w-8 px-2!"></th>
            <th className="w-20">ID</th>
            <th>Comment</th>
            <th className="w-32">Sentiment</th>
            <th className="w-32">Type</th>
            <th className="w-24">Status</th>
            <th className="w-28"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="px-2!">
                <div className="skeleton w-3.5 h-3.5 rounded" />
              </td>
              <td>
                <div className="skeleton h-3 w-14" />
              </td>
              <td>
                <div className="skeleton h-3 w-full max-w-md" />
              </td>
              <td>
                <div className="skeleton h-6 w-full rounded-md" />
              </td>
              <td>
                <div className="skeleton h-6 w-full rounded-md" />
              </td>
              <td>
                <div className="skeleton h-4 w-16 rounded-full" />
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <div className="skeleton h-6 w-14 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Version history modal                                               */
/* ------------------------------------------------------------------ */

function HistoryModal({ commentId, datasetId, onClose, onRestored }) {
  const queryClient = useQueryClient();
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["versions", commentId, page],
    queryFn: () => getCommentVersions(commentId, { page, limit }),
    enabled: !!commentId,
  });

  const versions = data?.versions || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const handleRestore = async (version) => {
    const ok = await confirmAction(
      `Restore from v${version}?`,
      `A new version will be created with the state of v${version}. Your history is preserved — nothing is deleted.`,
      "Restore",
    );
    if (!ok) return;

    setRestoringVersion(version);

    try {
      await restoreCommentVersion(commentId, version);
      await queryClient.invalidateQueries({
        queryKey: ["versions", commentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["comments"] });
      await queryClient.invalidateQueries({
        queryKey: ["dataset", datasetId],
      });
      onRestored(`Restored from v${version}`);
      setPage(1);
    } catch (err) {
      alertError(
        "Restore failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl p-0">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-base-200">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              {total} version{total === 1 ? "" : "s"} · restoring creates a new
              version
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
          {isLoading && <HistoryListSkeleton rows={3} />}

          {!isLoading && versions.length === 0 && (
            <p className="text-sm text-base-content/60 text-center py-4">
              No versions found.
            </p>
          )}

          {versions.length > 0 && (
            <ul className="space-y-2">
              {versions.map((v, idx) => {
                const isLatest = idx === 0 && page === 1;
                const isRestore = v.changeType === "restore";

                return (
                  <li
                    key={v._id}
                    className={`border rounded-lg p-3 ${
                      isLatest
                        ? "border-primary bg-primary/5"
                        : "border-base-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`badge badge-sm ${
                            isLatest ? "badge-primary" : ""
                          }`}
                        >
                          v{v.version}
                          {isLatest && " · current"}
                        </span>

                        <span
                          className={`badge badge-sm badge-outline ${
                            v.changeType === "import"
                              ? "badge-info"
                              : v.changeType === "annotation"
                                ? "badge-success"
                                : v.changeType === "update"
                                  ? "badge-warning"
                                  : v.changeType === "restore"
                                    ? "badge-secondary"
                                    : ""
                          }`}
                        >
                          {v.changeType}
                        </span>

                        {isRestore && v.restoredFrom && (
                          <span className="badge badge-sm badge-accent">
                            ← v{v.restoredFrom}
                          </span>
                        )}
                      </div>

                      {!isLatest && (
                        <button
                          className="btn btn-xs btn-outline gap-1"
                          onClick={() => handleRestore(v.version)}
                          disabled={restoringVersion !== null}
                        >
                          {restoringVersion === v.version ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Restore
                        </button>
                      )}
                    </div>

                    <div className="text-xs text-base-content/50 mb-2">
                      {new Date(v.createdAt).toLocaleString()}
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex gap-2">
                        <span className="text-base-content/50 w-20 shrink-0">
                          Sentiment
                        </span>
                        <strong>{v.snapshot.sentiment}</strong>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-base-content/50 w-20 shrink-0">
                          Type
                        </span>
                        <strong>{v.snapshot.type}</strong>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-base-content/50 w-20 shrink-0">
                          Status
                        </span>
                        <strong>{v.snapshot.status}</strong>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <span className="text-base-content/50 w-20 shrink-0">
                          Text
                        </span>
                        <span className="whitespace-pre-wrap wrap-break-word flex-1">
                          {v.snapshot.commentText}
                        </span>
                      </div>
                      {v.changedFields?.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          <span className="text-base-content/50 w-20 shrink-0">
                            Changed
                          </span>
                          <span className="font-mono text-[11px]">
                            {v.changedFields.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-base-200">
              <span className="text-xs text-base-content/60">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <div className="join">
                <button
                  className="btn btn-xs join-item gap-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Prev
                </button>
                <button
                  className="btn btn-xs join-item gap-1"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-base-200 flex justify-end">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}

function HistoryListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border border-base-300 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <div className="skeleton h-5 w-20 rounded-full" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton h-6 w-20 rounded-md" />
          </div>
          <div className="skeleton h-3 w-40 mb-3" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
