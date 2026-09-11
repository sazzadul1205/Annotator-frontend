// src/pages/DatasetDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  UserPlus,
  Save,
  Trash2,
  Search,
  CheckCircle2,
} from "lucide-react";
import { getDataset, assignDataset } from "../services/datasetApi";
import {
  listComments,
  annotateComment,
  deleteComment,
} from "../services/commentApi";
import { listUsers } from "../services/userApi";
import { useAuth } from "../context/useAuth";

const PAGE_SIZES = [5, 10, 20, 50];

export default function DatasetDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState("");
  const [hideAnnotated, setHideAnnotated] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [toast, setToast] = useState("");

  // rows[commentId] = { sentiment, type }
  const [rows, setRows] = useState({});

  // Dataset + summary
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

  // Users (admin only)
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

  // Comments
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

  // Seed local rows from server data (only for rows not yet in state)
  useEffect(() => {
    if (!comments.length) return;
    setRows((prev) => {
      const next = { ...prev };
      for (const c of comments) {
        if (next[c._id]) continue;
        next[c._id] = {
          sentiment: ["positive", "negative", "neutral"].includes(c.sentiment)
            ? c.sentiment
            : "",
          type: ["bangla", "english", "banglish"].includes(c.type)
            ? c.type
            : "",
        };
      }
      return next;
    });
  }, [commentsData]);

  const setRow = (commentId, patch) => {
    setRows((prev) => ({
      ...prev,
      [commentId]: { ...prev[commentId], ...patch },
    }));
  };

  // ---------- SAVE ANNOTATION ----------
  const handleSave = async (comment) => {
    const row = rows[comment._id];
    if (!row) return;

    if (!row.sentiment || !row.type) {
      setToast("Pick both sentiment and type");
      setTimeout(() => setToast(""), 2000);
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
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
      queryClient.invalidateQueries({ queryKey: ["comments"] });
    } catch (err) {
      setRow(comment._id, {
        sentiment: serverSentiment,
        type: serverType,
      });
      setToast(err?.response?.data?.error || err.message || "Save failed");
      setTimeout(() => setToast(""), 3000);
    }
  };

  // ---------- ASSIGN DATASET ----------
  const handleAssign = async (assignedTo) => {
    try {
      await assignDataset(id, assignedTo);
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    } catch (err) {
      setToast(err?.response?.data?.error || err.message || "Assign failed");
      setTimeout(() => setToast(""), 3000);
    }
  };

  // ---------- DELETE COMMENT ----------
  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment and all its versions?")) return;
    try {
      await deleteComment(commentId);
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["dataset", id] });
    } catch (err) {
      setToast(err?.response?.data?.error || err.message || "Delete failed");
      setTimeout(() => setToast(""), 3000);
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

  if (loadingDs) {
    return (
      <div className="flex justify-center py-10">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
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
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="alert alert-error">
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Header */}
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

          {/* Progress */}
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
          {loadingComments && (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner" />
            </div>
          )}

          {!loadingComments && comments.length === 0 && (
            <p className="text-center text-base-content/60 py-6">
              No comments found.
            </p>
          )}

          {comments.length > 0 && (
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
                      const row = rows[c._id] || { sentiment: "", type: "" };

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
                              <button
                                className="btn btn-xs btn-ghost text-error ml-1 gap-1"
                                onClick={() => handleDelete(c._id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Del
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination + page size */}
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
    </div>
  );
}