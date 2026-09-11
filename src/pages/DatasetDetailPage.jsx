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
import {
  toast,
  alertError,
  confirmAction,
  confirmDelete,
} from "../lib/swal";

const PAGE_SIZES = [5, 10, 20, 50];

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
        (["positive", "negative", "neutral"].includes(c.sentiment)
          ? c.sentiment
          : ""),
      type:
        local.type ??
        (["bangla", "english", "banglish"].includes(c.type) ? c.type : ""),
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

    const serverSentiment = ["positive", "negative", "neutral"].includes(
      comment.sentiment,
    )
      ? comment.sentiment
      : "";
    const serverType = ["bangla", "english", "banglish"].includes(comment.type)
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

  // Full-page skeleton while the dataset itself is loading
  if (loadingDs) {
    return <DatasetDetailSkeleton isAdmin={isAdmin} />;
  }

  // Not found
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link
            to="/datasets"
            className="text-xs link link-hover mb-1 flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Datasets
          </Link>
          <h1 className="text-2xl font-semibold">{dataset.name}</h1>
          <p className="text-xs text-base-content/60">
            {dataset.originalFileName} · {dataset.status}
          </p>
        </div>
      </div>

      {/* Info + progress */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body py-4">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="text-sm">
              <span className="text-base-content/60">Imported: </span>
              <strong>
                {dataset.importedRows}/{dataset.totalRows}
              </strong>
              {dataset.skippedRows > 0 && (
                <span className="text-warning ml-1">
                  ({dataset.skippedRows} skipped)
                </span>
              )}
            </div>

            <div className="text-sm">
              <span className="text-base-content/60">Assignee: </span>
              <strong>{isAdmin ? assigneeName() : "You"}</strong>
            </div>

            {isAdmin && (
              <div className="dropdown dropdown-end ml-auto">
                <button
                  tabIndex={0}
                  className="btn btn-sm btn-outline gap-1"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Dataset
                </button>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 rounded-box z-10 w-48 p-2 shadow"
                >
                  <li>
                    <button
                      onClick={() => handleAssign(null)}
                      disabled={!dataset.assignedTo}
                    >
                      Unassign
                    </button>
                  </li>
                  {annotators.length === 0 && (
                    <li className="disabled">
                      <span>No annotators</span>
                    </li>
                  )}
                  {annotators.map((u) => (
                    <li key={u._id}>
                      <button onClick={() => handleAssign(u._id)}>
                        {u.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-base-content/60">
                Annotation Progress
              </span>
              <span className="text-xs">
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
            <div className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
              {summary.pending} pending
              {summary.total > 0 && summary.pending === 0 && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  all done
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              className="select select-bordered select-sm"
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
                <span className="label-text text-sm">Hide annotated</span>
              </label>
            )}

            <form onSubmit={handleSearchSubmit} className="join">
              <input
                type="text"
                className="input input-bordered input-sm join-item w-64"
                placeholder="Search text..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                className="btn btn-sm join-item gap-1"
                type="submit"
              >
                <Search className="w-3.5 h-3.5" />
                Go
              </button>
            </form>

            <span className="text-sm text-base-content/60 ml-auto">
              {total} comments
            </span>
          </div>
        </div>
      </div>

      {/* Comments table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {loadingComments ? (
            <CommentsTableSkeleton rows={pageSize > 20 ? 10 : pageSize} />
          ) : comments.length === 0 ? (
            <p className="text-center text-base-content/60 py-6">
              No comments found.
            </p>
          ) : (
            <>
              <div>
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
                    {comments.map((c) => {
                      const row = resolveRow(c);

                      const serverSentiment = [
                        "positive",
                        "negative",
                        "neutral",
                      ].includes(c.sentiment)
                        ? c.sentiment
                        : "";
                      const serverType = [
                        "bangla",
                        "english",
                        "banglish",
                      ].includes(c.type)
                        ? c.type
                        : "";

                      const dirty =
                        row.sentiment !== serverSentiment ||
                        row.type !== serverType;
                      const canSave = dirty && !!row.sentiment && !!row.type;

                      return (
                        <tr key={c._id}>
                          <td className="text-xs font-mono">{c.sourceId}</td>
                          <td className="max-w-md">
                            <span className="line-clamp-2">
                              {c.commentText}
                            </span>
                          </td>
                          <td>
                            <select
                              className="select select-bordered select-xs w-28"
                              value={row.sentiment}
                              onChange={(e) =>
                                setRow(c._id, { sentiment: e.target.value })
                              }
                            >
                              <option value="">—</option>
                              <option value="positive">positive</option>
                              <option value="negative">negative</option>
                              <option value="neutral">neutral</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="select select-bordered select-xs w-24"
                              value={row.type}
                              onChange={(e) =>
                                setRow(c._id, { type: e.target.value })
                              }
                            >
                              <option value="">—</option>
                              <option value="bangla">bangla</option>
                              <option value="english">english</option>
                              <option value="banglish">banglish</option>
                            </select>
                          </td>
                          <td>
                            <span
                              className={`badge badge-sm ${c.status === "annotated"
                                  ? "badge-success"
                                  : "badge-warning"
                                }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              className="btn btn-xs btn-primary gap-1"
                              onClick={() => handleSave(c)}
                              disabled={!canSave}
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  className="btn btn-xs btn-ghost ml-1 gap-1"
                                  onClick={() => setHistoryCommentId(c._id)}
                                  title="Version history"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  History
                                </button>
                                <button
                                  className="btn btn-xs btn-ghost text-error ml-1 gap-1"
                                  onClick={() => handleDelete(c._id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Del
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-base-content/60">
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

                <span className="text-xs text-base-content/60">
                  Page {page} of {totalPages}
                </span>

                <div className="join">
                  <button
                    className="btn btn-sm join-item"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    «
                  </button>
                  <button
                    className="btn btn-sm join-item"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    »
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

// Skeleton loaders

function DatasetDetailSkeleton({ isAdmin }) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="w-full">
          <div className="skeleton h-3 w-32 mb-2" />
          <div className="skeleton h-7 w-64 mb-2" />
          <div className="skeleton h-3 w-40" />
        </div>
      </div>

      {/* Info + progress card */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body py-4">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-4 w-40" />
            {isAdmin && <div className="skeleton h-8 w-36 ml-auto" />}
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-3 w-full rounded-full" />
          <div className="skeleton h-3 w-24 mt-2" />
        </div>
      </div>

      {/* Filters card */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-4 w-24 ml-auto" />
          </div>
        </div>
      </div>

      {/* Comments card */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <CommentsTableSkeleton rows={8} />
        </div>
      </div>
    </div>
  );
}

function CommentsTableSkeleton({ rows = 8 }) {
  const skeletonRows = Array.from({ length: rows });

  return (
    <div>
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

      {/* Pagination skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

// Version history modal
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
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </h3>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-base-content/50 mb-4">
          Restoring a version creates a new version. No history is deleted.
        </p>

        {/* Skeleton while loading versions */}
        {isLoading && <HistoryListSkeleton rows={3} />}

        {!isLoading && versions.length === 0 && (
          <p className="text-sm text-base-content/60 text-center py-4">
            No versions found.
          </p>
        )}

        {versions.length > 0 && (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {versions.map((v, idx) => {
              const isLatest = idx === 0;
              const isRestore = v.changeType === "restore";

              return (
                <li
                  key={v._id}
                  className={`border rounded-lg p-3 ${isLatest
                      ? "border-primary bg-primary/5"
                      : "border-base-300"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge badge-sm ${isLatest ? "badge-primary" : ""
                          }`}
                      >
                        v{v.version}
                        {isLatest && " · current"}
                      </span>

                      <span
                        className={`badge badge-sm badge-outline ${v.changeType === "import"
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
                          ← from v{v.restoredFrom}
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

                  <div className="text-xs text-base-content/60 mb-2">
                    {new Date(v.createdAt).toLocaleString()}
                  </div>

                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-base-content/50">Sentiment:</span>{" "}
                      <strong>{v.snapshot.sentiment}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/50">Type:</span>{" "}
                      <strong>{v.snapshot.type}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/50">Status:</span>{" "}
                      <strong>{v.snapshot.status}</strong>
                    </div>
                    <div className="pt-1">
                      <span className="text-base-content/50">Text:</span>{" "}
                      <span className="whitespace-pre-wrap wrap-break-word">
                        {v.snapshot.commentText}
                      </span>
                    </div>
                    {v.changedFields?.length > 0 && (
                      <div className="pt-1">
                        <span className="text-base-content/50">Changed:</span>{" "}
                        <span className="font-mono">
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

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}

// Small skeleton used inside the History modal while versions load
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