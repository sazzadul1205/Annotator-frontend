// React
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Icons
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
  Filter,
  ListFilter,
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
const SENTIMENTS = ["positive", "negative", "neutral"];
const TYPES = ["bangla", "english", "banglish"];

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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link
            to="/datasets"
            className="text-xs link link-hover mb-1 inline-flex items-center gap-1 text-base-content/60"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Datasets
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            {dataset.name}
          </h1>
          <p className="text-xs sm:text-sm text-base-content/60 mt-1 flex items-center gap-2 flex-wrap">
            <span className="truncate">{dataset.originalFileName}</span>
            <StatusBadge status={dataset.status} />
          </p>
        </div>
      </div>

      {/* Info + progress */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            {/* Imported */}
            <div className="flex flex-col">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">
                Imported rows
              </span>
              <span className="text-sm sm:text-base font-semibold">
                {dataset.importedRows}
                <span className="text-base-content/50 font-normal">
                  {" "}
                  / {dataset.totalRows}
                </span>
                {dataset.skippedRows > 0 && (
                  <span className="text-warning ml-2 text-xs">
                    ({dataset.skippedRows} skipped)
                  </span>
                )}
              </span>
            </div>

            {/* Assignee */}
            <div className="flex flex-col">
              <span className="text-xs text-base-content/50 uppercase tracking-wide">
                Assignee
              </span>
              <span className="text-sm sm:text-base font-semibold truncate">
                {isAdmin ? assigneeName() : "You"}
              </span>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="flex sm:justify-end items-center">
                <AssignDropdown
                  annotators={annotators}
                  assignedTo={dataset.assignedTo}
                  onAssign={handleAssign}
                />
              </div>
            )}
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-base-content/60 font-medium">
                Annotation Progress
              </span>
              <span className="text-xs sm:text-sm">
                <strong>{summary.annotated}</strong>
                <span className="text-base-content/60"> / {summary.total}</span>
                <span className="ml-2 badge badge-sm badge-ghost">
                  {progressPct}%
                </span>
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={summary.annotated}
              max={summary.total || 1}
            />
            <div className="text-xs text-base-content/50 mt-1.5 flex items-center gap-1">
              {summary.pending} pending
              {summary.total > 0 && summary.pending === 0 && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-success font-medium">all done</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Left group: status + hide */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-base-content/60">
                <Filter className="w-3.5 h-3.5" />
                <span className="text-xs font-medium hidden sm:inline">
                  Status
                </span>
              </div>
              <select
                className="select select-bordered select-sm w-full sm:w-auto"
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
                    className="checkbox checkbox-sm"
                    checked={hideAnnotated}
                    onChange={(e) => {
                      setHideAnnotated(e.target.checked);
                      setPage(1);
                    }}
                  />
                  <span className="label-text text-xs sm:text-sm">
                    Hide annotated
                  </span>
                </label>
              )}
            </div>

            {/* Search */}
            <form
              onSubmit={handleSearchSubmit}
              className="join w-full lg:w-auto lg:ml-auto"
            >
              <label className="input input-bordered input-sm join-item flex items-center gap-2 flex-1 lg:w-64">
                <Search className="w-3.5 h-3.5 text-base-content/40" />
                <input
                  type="text"
                  className="grow"
                  placeholder="Search text..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </label>
              <button className="btn btn-sm join-item" type="submit">
                Go
              </button>
            </form>

            {/* Count */}
            <span className="text-xs sm:text-sm text-base-content/60 whitespace-nowrap">
              <strong className="text-base-content">{total}</strong> comments
            </span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0 sm:p-2">
          {loadingComments ? (
            <CommentsTableSkeleton rows={pageSize > 20 ? 8 : pageSize} />
          ) : comments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <ListFilter className="w-10 h-10 mx-auto text-base-content/30 mb-3" />
              <p className="font-medium">No comments found</p>
              <p className="text-sm text-base-content/60 mt-1">
                Try adjusting your filters or search.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead className="sticky top-0 bg-base-100 z-10">
                    <tr>
                      <th className="w-24">ID</th>
                      <th>Comment</th>
                      <th className="w-32">Sentiment</th>
                      <th className="w-28">Type</th>
                      <th className="w-24">Status</th>
                      <th className="text-right w-56">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comments.map((c) => (
                      <CommentRow
                        key={c._id}
                        comment={c}
                        isAdmin={isAdmin}
                        row={resolveRow(c)}
                        setRow={setRow}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onHistory={setHistoryCommentId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet cards */}
              <div className="lg:hidden divide-y divide-base-200">
                {comments.map((c) => (
                  <CommentCard
                    key={c._id}
                    comment={c}
                    isAdmin={isAdmin}
                    row={resolveRow(c)}
                    setRow={setRow}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onHistory={setHistoryCommentId}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-base-200">
                <div className="flex items-center gap-2 order-2 sm:order-1">
                  <span className="text-xs text-base-content/60 whitespace-nowrap">
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

                <span className="text-xs text-base-content/60 text-center order-3 sm:order-2">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>

                <div className="join order-1 sm:order-3 self-stretch sm:self-auto">
                  <button
                    className="btn btn-sm join-item flex-1 sm:flex-none gap-1"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    className="btn btn-sm join-item flex-1 sm:flex-none gap-1"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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

/* ---------------------------------------------------------------- */
/* Assign dropdown (portal-based, never clipped)                    */
/* ---------------------------------------------------------------- */
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
        className="btn btn-sm btn-outline gap-2 w-full sm:w-auto"
        onClick={toggle}
      >
        <UserPlus className="w-4 h-4" />
        Assign Dataset
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

/* ---------------------------------------------------------------- */
/* Desktop table row                                                */
/* ---------------------------------------------------------------- */
function CommentRow({
  comment,
  isAdmin,
  row,
  setRow,
  onSave,
  onDelete,
  onHistory,
}) {
  const serverSentiment = SENTIMENTS.includes(comment.sentiment)
    ? comment.sentiment
    : "";
  const serverType = TYPES.includes(comment.type) ? comment.type : "";
  const dirty = row.sentiment !== serverSentiment || row.type !== serverType;
  const canSave = dirty && !!row.sentiment && !!row.type;

  return (
    <tr className={dirty ? "bg-warning/5" : ""}>
      <td className="text-xs font-mono text-base-content/60">
        {comment.sourceId}
      </td>
      <td className="max-w-md">
        <span className="line-clamp-2 text-sm">{comment.commentText}</span>
      </td>
      <td>
        <select
          className={`select select-bordered select-xs w-full max-w-32 ${
            dirty && !row.sentiment ? "select-warning" : ""
          }`}
          value={row.sentiment}
          onChange={(e) => setRow(comment._id, { sentiment: e.target.value })}
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
          className={`select select-bordered select-xs w-full max-w-28 ${
            dirty && !row.type ? "select-warning" : ""
          }`}
          value={row.type}
          onChange={(e) => setRow(comment._id, { type: e.target.value })}
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
        <StatusBadge status={comment.status} />
      </td>
      <td className="text-right whitespace-nowrap">
        <button
          className="btn btn-xs btn-primary gap-1"
          onClick={() => onSave(comment)}
          disabled={!canSave}
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>

        {isAdmin && (
          <>
            <button
              className="btn btn-xs btn-ghost ml-1 gap-1"
              onClick={() => onHistory(comment._id)}
              title="Version history"
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
            <button
              className="btn btn-xs btn-ghost text-error ml-1 gap-1"
              onClick={() => onDelete(comment._id)}
              title="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Del
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------- */
/* Mobile comment card                                              */
/* ---------------------------------------------------------------- */
function CommentCard({
  comment,
  isAdmin,
  row,
  setRow,
  onSave,
  onDelete,
  onHistory,
}) {
  const serverSentiment = SENTIMENTS.includes(comment.sentiment)
    ? comment.sentiment
    : "";
  const serverType = TYPES.includes(comment.type) ? comment.type : "";
  const dirty = row.sentiment !== serverSentiment || row.type !== serverType;
  const canSave = dirty && !!row.sentiment && !!row.type;

  return (
    <div className={`p-4 ${dirty ? "bg-warning/5" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-mono text-base-content/50">
          {comment.sourceId}
        </span>
        <StatusBadge status={comment.status} />
      </div>

      {/* Comment text */}
      <p className="text-sm mb-3 leading-relaxed">{comment.commentText}</p>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-base-content/50 block mb-1">
            Sentiment
          </label>
          <select
            className={`select select-bordered select-sm w-full ${
              dirty && !row.sentiment ? "select-warning" : ""
            }`}
            value={row.sentiment}
            onChange={(e) => setRow(comment._id, { sentiment: e.target.value })}
          >
            <option value="">—</option>
            {SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-base-content/50 block mb-1">
            Type
          </label>
          <select
            className={`select select-bordered select-sm w-full ${
              dirty && !row.type ? "select-warning" : ""
            }`}
            value={row.type}
            onChange={(e) => setRow(comment._id, { type: e.target.value })}
          >
            <option value="">—</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          className="btn btn-xs btn-primary gap-1 flex-1 sm:flex-none"
          onClick={() => onSave(comment)}
          disabled={!canSave}
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>

        {isAdmin && (
          <>
            <button
              className="btn btn-xs btn-ghost gap-1"
              onClick={() => onHistory(comment._id)}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
            <button
              className="btn btn-xs btn-ghost text-error gap-1"
              onClick={() => onDelete(comment._id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Status badge                                                     */
/* ---------------------------------------------------------------- */
function StatusBadge({ status }) {
  const map = {
    pending: "badge-warning",
    processing: "badge-info",
    completed: "badge-success",
    failed: "badge-error",
    annotated: "badge-success",
  };

  return (
    <span
      className={`badge ${map[status] || "badge-ghost"} badge-sm capitalize`}
    >
      {status}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Skeleton loaders                                                 */
/* ---------------------------------------------------------------- */
function DatasetDetailSkeleton({ isAdmin }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="skeleton h-3 w-32 mb-2" />
        <div className="skeleton h-8 w-64 mb-2" />
        <div className="skeleton h-4 w-48" />
      </div>

      {/* Info card */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-32" />
            </div>
            <div className="space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-28" />
            </div>
            {isAdmin && (
              <div className="flex sm:justify-end">
                <div className="skeleton h-8 w-40" />
              </div>
            )}
          </div>
          <div className="flex justify-between mb-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-3 w-full rounded-full" />
        </div>
      </div>

      {/* Filters card */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body p-4">
          <div className="flex flex-wrap gap-3">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-8 w-64 ml-auto" />
          </div>
        </div>
      </div>

      {/* Comments card */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0 sm:p-2">
          <CommentsTableSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}

function CommentsTableSkeleton({ rows = 6 }) {
  const skeletonRows = Array.from({ length: rows });

  return (
    <div className="p-4">
      {/* Desktop */}
      <div className="hidden lg:block">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Comment</th>
              <th>Sentiment</th>
              <th>Type</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {skeletonRows.map((_, i) => (
              <tr key={i}>
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
      </div>

      {/* Mobile */}
      <div className="lg:hidden divide-y divide-base-200">
        {skeletonRows.map((_, i) => (
          <div key={i} className="py-4">
            <div className="flex justify-between gap-3 mb-2">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton h-3 w-full mb-1" />
            <div className="skeleton h-3 w-3/4 mb-3" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
            </div>
            <div className="flex gap-1">
              <div className="skeleton h-6 w-16 rounded-md" />
              <div className="skeleton h-6 w-20 rounded-md" />
              <div className="skeleton h-6 w-14 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 pt-4 border-t border-base-200">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-3 w-24 mx-auto" />
        <div className="skeleton h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Version history modal                                            */
/* ---------------------------------------------------------------- */
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-base-200">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History className="w-5 h-5" />
              Version History
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              Restoring creates a new version. No history is deleted.
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

        {/* Body */}
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
                const isLatest = idx === 0;
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
        </div>

        {/* Footer */}
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
