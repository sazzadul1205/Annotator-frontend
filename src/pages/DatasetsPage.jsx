// React
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Icons
import {
  ArrowLeft,
  UserPlus,
  Save,
  Trash2,
  Search,
  CheckCircle2,
  History,
  RotateCcw,
  X,
  Database,
  FileText,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// Services
import {
  listComments,
  annotateComment,
  deleteComment,
  getCommentVersions,
  restoreCommentVersion,
} from "../services/commentApi";
import { listUsers } from "../services/userApi";
import { getDataset, assignDataset } from "../services/datasetApi";

// Context
import { useAuth } from "../context/useAuth";

// Lib
import { toast, alertError, confirmAction, confirmDelete } from "../lib/swal";

const PAGE_SIZES = [5, 10, 20, 50];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SENTIMENTS = ["positive", "negative", "neutral"];
const TYPES = ["bangla", "english", "banglish"];

const sentimentColor = (s) =>
  s === "positive"
    ? "text-success"
    : s === "negative"
      ? "text-error"
      : s === "neutral"
        ? "text-info"
        : "text-base-content/40";

const statusBadgeClass = (status) =>
  status === "annotated" ? "badge-success" : "badge-warning";

export default function DatasetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  // Pagination and filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [hideAnnotated, setHideAnnotated] = useState(true);
  const [historyCommentId, setHistoryCommentId] = useState(null);

  // Store unsaved changes for each comment
  const [rows, setRows] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Fetch dataset details and summary
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

  // Fetch users for admin assignment controls
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

  // Build query parameters for the comments request
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

  // Update unsaved changes for a specific comment
  const setRow = (commentId, patch) => {
    setRows((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], ...patch },
    }));
  };

  // Get the current values for a comment
  const resolveRow = (c) => {
    const local = rows[c._id] || {};
    return {
      sentiment:
        local.sentiment ??
        (SENTIMENTS.includes(c.sentiment) ? c.sentiment : ""),
      type: local.type ?? (TYPES.includes(c.type) ? c.type : ""),
    };
  };

  const clearRow = (commentId) => {
    setRows((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const handleSave = async (comment) => {
    const row = resolveRow(comment);

    if (!row.sentiment || !row.type) {
      toast("Pick both sentiment and type", "warning");
      return;
    }

    const serverSentiment = SENTIMENTS.includes(comment.sentiment)
      ? comment.sentiment
      : "";
    const serverType = TYPES.includes(comment.type) ? comment.type : "";

    if (row.sentiment === serverSentiment && row.type === serverType) {
      return;
    }

    setSavingId(comment._id);
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
    } finally {
      setSavingId(null);
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

  // ---------- Render ----------

  if (loadingDs) {
    return <DatasetDetailSkeleton />;
  }

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
          <Database className="w-6 h-6 text-base-content/40" />
        </div>
        <p className="text-base-content/60 mb-4">Dataset not found.</p>
        <Link to="/datasets" className="btn btn-primary btn-sm gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Datasets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/datasets"
            className="inline-flex items-center gap-1 text-xs text-base-content/50 hover:text-base-content transition-colors mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Datasets
          </Link>

          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Database className="w-4.5 h-4.5" />
            </div>
            <span className="truncate">{dataset.name}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-base-content/60">
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {dataset.originalFileName}
            </span>
            <span className="text-base-content/30">·</span>
            <span
              className={`badge badge-xs capitalize ${
                dataset.status === "completed"
                  ? "badge-success"
                  : dataset.status === "in-progress"
                    ? "badge-info"
                    : "badge-ghost"
              }`}
            >
              {dataset.status}
            </span>
          </div>
        </div>

        {/* Assign control */}
        {isAdmin && (
          <div className="dropdown dropdown-end shrink-0">
            <button tabIndex={0} className="btn btn-sm btn-outline gap-2">
              <UserPlus className="w-4 h-4" />
              Assign
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-box z-10 w-56 p-2 shadow-xl border border-base-content/5 mt-2"
            >
              <li className="menu-title text-[10px] uppercase tracking-widest">
                Assign to
              </li>
              <li>
                <button
                  onClick={() => handleAssign(null)}
                  disabled={!dataset.assignedTo}
                  className="text-base-content/70"
                >
                  Unassign
                </button>
              </li>
              {annotators.length === 0 && (
                <li className="disabled">
                  <span className="text-base-content/40">No annotators</span>
                </li>
              )}
              {annotators.map((u) => (
                <li key={u._id}>
                  <button
                    onClick={() => handleAssign(u._id)}
                    className={
                      u._id === dataset.assignedTo ? "active font-medium" : ""
                    }
                  >
                    {u.name}
                    {u._id === dataset.assignedTo && (
                      <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-success" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- Stats + progress ---------- */}
      <div className="card bg-base-100/80 backdrop-blur-xl shadow-xl border border-base-content/5">
        <div className="card-body p-5 sm:p-6">
          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatTile
              label="Imported"
              value={`${dataset.importedRows}/${dataset.totalRows}`}
              hint={
                dataset.skippedRows > 0
                  ? `${dataset.skippedRows} skipped`
                  : null
              }
              hintTone="warning"
            />
            <StatTile
              label="Annotated"
              value={summary.annotated}
              hint={`${progressPct}% complete`}
              hintTone="success"
            />
            <StatTile
              label="Pending"
              value={summary.pending}
              hint={
                summary.total > 0 && summary.pending === 0 ? "all done" : null
              }
              hintTone="success"
            />
            <StatTile
              label="Assignee"
              value={isAdmin ? assigneeName() : "You"}
            />
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-widest text-base-content/50">
                Progress
              </span>
              <span className="text-xs text-base-content/60">
                <strong className="text-base-content">
                  {summary.annotated}
                </strong>{" "}
                / {summary.total}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full h-2"
              value={summary.annotated}
              max={summary.total || 1}
            />
          </div>
        </div>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="card bg-base-100/80 backdrop-blur-xl shadow-xl border border-base-content/5">
        <div className="card-body p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-base-content/50">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-widest font-semibold">
                Filters
              </span>
            </div>

            <select
              className="select select-bordered select-sm focus:select-primary transition-all"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending only</option>
              <option value="annotated">Annotated only</option>
            </select>

            {!filterStatus && (
              <label className="label cursor-pointer gap-2 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={hideAnnotated}
                  onChange={(e) => {
                    setHideAnnotated(e.target.checked);
                    setPage(1);
                  }}
                />
                <span className="label-text text-sm">Hide annotated</span>
              </label>
            )}

            <form onSubmit={handleSearchSubmit} className="join ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
                <input
                  type="text"
                  className="input input-bordered input-sm join-item w-56 sm:w-64 pl-9 focus:input-primary transition-all"
                  placeholder="Search text…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <button className="btn btn-sm join-item" type="submit">
                Go
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-content/5">
            <span className="text-xs text-base-content/50">
              <strong className="text-base-content">{total}</strong>{" "}
              {total === 1 ? "comment" : "comments"}
              {search && (
                <>
                  {" "}
                  matching{" "}
                  <span className="font-mono text-base-content">
                    "{search}"
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Comments table ---------- */}
      <div className="card bg-base-100/80 backdrop-blur-xl shadow-xl border border-base-content/5">
        <div className="card-body p-0">
          {loadingComments ? (
            <div className="p-5">
              <CommentsTableSkeleton rows={pageSize > 20 ? 10 : pageSize} />
            </div>
          ) : comments.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No comments found"
              hint="Try adjusting filters or search."
            />
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="border-base-content/5">
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold pl-5">
                        ID
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Comment
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Sentiment
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Type
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Status
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right pr-5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comments.map((c) => {
                      const row = resolveRow(c);
                      const serverSentiment = SENTIMENTS.includes(c.sentiment)
                        ? c.sentiment
                        : "";
                      const serverType = TYPES.includes(c.type) ? c.type : "";
                      const dirty =
                        row.sentiment !== serverSentiment ||
                        row.type !== serverType;
                      const canSave = dirty && !!row.sentiment && !!row.type;
                      const isSaving = savingId === c._id;

                      return (
                        <tr
                          key={c._id}
                          className={`border-base-content/5 transition-colors ${
                            dirty
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-base-200/40"
                          }`}
                        >
                          <td className="pl-5">
                            <span className="text-xs font-mono text-base-content/60">
                              {c.sourceId}
                            </span>
                          </td>

                          <td className="max-w-md">
                            <span className="line-clamp-2 text-sm">
                              {c.commentText}
                            </span>
                          </td>

                          <td>
                            <select
                              className={`select select-bordered select-xs w-28 focus:select-primary transition-all ${sentimentColor(
                                row.sentiment,
                              )}`}
                              value={row.sentiment}
                              onChange={(e) =>
                                setRow(c._id, { sentiment: e.target.value })
                              }
                            >
                              <option value="">—</option>
                              {SENTIMENTS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <select
                              className="select select-bordered select-xs w-24 focus:select-primary transition-all"
                              value={row.type}
                              onChange={(e) =>
                                setRow(c._id, { type: e.target.value })
                              }
                            >
                              <option value="">—</option>
                              {TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <span
                              className={`badge badge-sm capitalize ${statusBadgeClass(
                                c.status,
                              )}`}
                            >
                              {c.status}
                            </span>
                          </td>

                          <td className="text-right whitespace-nowrap pr-5">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                className={`btn btn-xs gap-1 normal-case ${
                                  canSave
                                    ? "btn-primary shadow-sm shadow-primary/20"
                                    : "btn-ghost text-base-content/40"
                                }`}
                                onClick={() => handleSave(c)}
                                disabled={!canSave || isSaving}
                                title="Save annotation"
                              >
                                {isSaving ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">Save</span>
                              </button>

                              {isAdmin && (
                                <>
                                  <button
                                    className="btn btn-xs btn-ghost text-base-content/70 hover:text-base-content normal-case gap-1"
                                    onClick={() => setHistoryCommentId(c._id)}
                                    title="Version history"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">
                                      History
                                    </span>
                                  </button>
                                  <button
                                    className="btn btn-xs btn-ghost text-base-content/70 hover:text-error hover:bg-error/10 normal-case gap-1"
                                    onClick={() => handleDelete(c._id)}
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">
                                      Delete
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-base-content/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-base-content/50">
                    Rows per page
                  </span>
                  <select
                    className="select select-bordered select-xs w-20"
                    value={pageSize}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value))
                    }
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs text-base-content/50">
                  Page <strong className="text-base-content">{page}</strong> of{" "}
                  {totalPages}
                </span>

                <div className="join">
                  <button
                    className="btn btn-sm join-item"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    className="btn btn-sm join-item"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, hint, hintTone = "neutral" }) {
  const hintClass =
    hintTone === "warning"
      ? "text-warning"
      : hintTone === "success"
        ? "text-success"
        : "text-base-content/50";

  return (
    <div className="rounded-xl bg-base-200/50 border border-base-content/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
        {label}
      </p>
      <p className="text-lg font-semibold leading-tight mt-1 truncate">
        {value}
      </p>
      {hint && <p className={`text-[11px] mt-0.5 ${hintClass}`}>{hint}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-base-content/40" />
      </div>
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-base-content/60 mt-1">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function DatasetDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="skeleton h-3 w-32 mb-2" />
        <div className="flex items-center gap-2.5 mb-2">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div className="skeleton h-7 w-64" />
        </div>
        <div className="skeleton h-3 w-52" />
      </div>

      {/* Stats card */}
      <div className="card bg-base-100/80 border border-base-content/5">
        <div className="card-body p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-base-200/50 border border-base-content/5 p-3"
              >
                <div className="skeleton h-2.5 w-16 mb-2" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="skeleton h-2.5 w-24 mb-2" />
          <div className="skeleton h-2 w-full rounded-full" />
        </div>
      </div>

      {/* Filters card */}
      <div className="card bg-base-100/80 border border-base-content/5">
        <div className="card-body p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="skeleton h-8 w-24" />
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-8 w-64 ml-auto" />
          </div>
        </div>
      </div>

      {/* Comments card */}
      <div className="card bg-base-100/80 border border-base-content/5">
        <div className="card-body p-5">
          <CommentsTableSkeleton rows={8} />
        </div>
      </div>
    </div>
  );
}

function CommentsTableSkeleton({ rows = 8 }) {
  return (
    <div>
      <table className="table table-sm">
        <thead>
          <tr className="border-base-content/5">
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              ID
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Comment
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Sentiment
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Type
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Status
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-base-content/5">
              <td>
                <div className="skeleton h-3 w-12" />
              </td>
              <td className="max-w-md">
                <div className="skeleton h-3 w-full mb-1" />
                <div className="skeleton h-3 w-2/3" />
              </td>
              <td>
                <div className="skeleton h-6 w-28 rounded-md" />
              </td>
              <td>
                <div className="skeleton h-6 w-24 rounded-md" />
              </td>
              <td>
                <div className="skeleton h-5 w-20 rounded-full" />
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <div className="skeleton h-6 w-16 rounded-md" />
                  <div className="skeleton h-6 w-20 rounded-md" />
                  <div className="skeleton h-6 w-14 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History Modal                                                       */
/* ------------------------------------------------------------------ */

const changeTypeBadge = (type) => {
  switch (type) {
    case "import":
      return "badge-info";
    case "annotation":
      return "badge-success";
    case "update":
      return "badge-warning";
    case "restore":
      return "badge-secondary";
    default:
      return "";
  }
};

function HistoryModal({ commentId, datasetId, onClose, onRestored }) {
  const queryClient = useQueryClient();
  const [restoringVersion, setRestoringVersion] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["versions", commentId],
    queryFn: () => getCommentVersions(commentId),
    enabled: !!commentId,
  });

  const versions = data?.versions || [];

  const handleRestore = async (version) => {
    const ok = await confirmAction(
      `Restore from v${version}?`,
      "A new version will be created with the state of v" +
        version +
        ". Your history is preserved — nothing is deleted.",
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
      <div className="modal-box max-w-2xl bg-base-100/95 backdrop-blur-xl border border-base-content/5 shadow-2xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-base-content/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Version History</h3>
              <p className="text-xs text-base-content/50">
                Restoring creates a new version — nothing is deleted
              </p>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {isLoading && <HistoryListSkeleton rows={3} />}

          {!isLoading && versions.length === 0 && (
            <EmptyState
              icon={History}
              title="No versions yet"
              hint="Versions appear as the comment is edited."
            />
          )}

          {!isLoading && versions.length > 0 && (
            <ul className="space-y-2">
              {versions.map((v, idx) => {
                const isLatest = idx === 0;
                const isRestore = v.changeType === "restore";

                return (
                  <li
                    key={v._id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isLatest
                        ? "border-primary/40 bg-primary/5"
                        : "border-base-content/5 hover:border-base-content/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`badge badge-sm gap-1 ${
                            isLatest ? "badge-primary" : "badge-ghost"
                          }`}
                        >
                          {isLatest && <Sparkles className="w-2.5 h-2.5" />}v
                          {v.version}
                          {isLatest && " · current"}
                        </span>

                        <span
                          className={`badge badge-sm badge-outline capitalize ${changeTypeBadge(
                            v.changeType,
                          )}`}
                        >
                          {v.changeType}
                        </span>

                        {isRestore && v.restoredFrom && (
                          <span className="badge badge-sm badge-accent gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />
                            from v{v.restoredFrom}
                          </span>
                        )}
                      </div>

                      {!isLatest && (
                        <button
                          className="btn btn-xs btn-outline gap-1 normal-case"
                          onClick={() => handleRestore(v.version)}
                          disabled={restoringVersion !== null}
                        >
                          {restoringVersion === v.version ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restore
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-base-content/50 mb-3">
                      <Clock className="w-3 h-3" />
                      {new Date(v.createdAt).toLocaleString()}
                    </div>

                    {/* Snapshot grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <SnapshotChip
                        label="Sentiment"
                        value={v.snapshot.sentiment}
                      />
                      <SnapshotChip label="Type" value={v.snapshot.type} />
                      <SnapshotChip label="Status" value={v.snapshot.status} />
                    </div>

                    {/* Text snapshot */}
                    <div className="rounded-lg bg-base-200/50 border border-base-content/5 p-2.5 mb-2">
                      <p className="text-[10px] uppercase tracking-widest text-base-content/50 font-semibold mb-1">
                        Text
                      </p>
                      <p className="text-xs whitespace-pre-wrap wrap-break-word">
                        {v.snapshot.commentText}
                      </p>
                    </div>

                    {v.changedFields?.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-base-content/50">Changed:</span>
                        <div className="flex flex-wrap gap-1">
                          {v.changedFields.map((f) => (
                            <span
                              key={f}
                              className="badge badge-xs badge-ghost font-mono"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-base-content/5 bg-base-200/40">
          <button
            className="btn btn-sm btn-ghost normal-case font-normal"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div
        className="modal-backdrop bg-base-content/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}

function SnapshotChip({ label, value }) {
  return (
    <div className="rounded-lg bg-base-200/50 border border-base-content/5 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-base-content/50 font-semibold">
        {label}
      </p>
      <p className="text-xs font-medium truncate">{value || "—"}</p>
    </div>
  );
}

function HistoryListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border border-base-content/5 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <div className="skeleton h-5 w-20 rounded-full" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton h-6 w-20 rounded-md" />
          </div>
          <div className="skeleton h-3 w-40 mb-3" />
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
          <div className="skeleton h-12 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
