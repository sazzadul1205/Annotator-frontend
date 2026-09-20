// src/pages/AuditPage.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  FileText,
  Database,
  MessageSquare,
  ShieldCheck,
  LogIn,
  LogOut,
} from "lucide-react";
import { listAuditEntries, listAuditActions } from "../services/auditApi";

const ACTION_ICONS = {
  "auth.login": LogIn,
  "auth.logout": LogOut,
  "auth.bootstrap": ShieldCheck,
  "user.create": UserIcon,
  "user.update": UserIcon,
  "user.delete": UserIcon,
  "user.activate": UserIcon,
  "user.deactivate": UserIcon,
  "user.password_reset": ShieldCheck,
  "dataset.delete": Database,
  "dataset.rename": Database,
  "dataset.assign": Database,
  "dataset.unassign": Database,
  "dataset.duplicate": Database,
  "dataset.import_started": Database,
  "comment.delete": MessageSquare,
  "comment.bulk_annotate": MessageSquare,
  "comment.bulk_assign": MessageSquare,
  "comment.bulk_unassign": MessageSquare,
};

const ACTION_COLORS = {
  "auth.login": "text-info",
  "auth.logout": "text-base-content/50",
  "auth.bootstrap": "text-success",
  "user.create": "text-success",
  "user.update": "text-warning",
  "user.delete": "text-error",
  "user.activate": "text-success",
  "user.deactivate": "text-warning",
  "user.password_reset": "text-warning",
  "dataset.delete": "text-error",
  "dataset.rename": "text-info",
  "dataset.assign": "text-primary",
  "dataset.unassign": "text-warning",
  "dataset.duplicate": "text-info",
  "dataset.import_started": "text-primary",
  "comment.delete": "text-error",
  "comment.bulk_annotate": "text-primary",
  "comment.bulk_assign": "text-primary",
  "comment.bulk_unassign": "text-warning",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");

  const params = {
    page,
    limit,
    ...(action && { action }),
    ...(targetType && { targetType }),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", params],
    queryFn: () => listAuditEntries(params),
  });

  const { data: actionsData } = useQuery({
    queryKey: ["audit-actions"],
    queryFn: listAuditActions,
  });

  const entries = data?.entries || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const actionOptions = actionsData?.actions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Track every important action in the workspace.
          </p>
        </div>
        <div className="badge badge-outline badge-lg self-start sm:self-auto">
          {total} entries
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              className="select select-bordered select-sm w-full sm:w-64"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm w-full sm:w-48"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All targets</option>
              <option value="user">Users</option>
              <option value="dataset">Datasets</option>
              <option value="comment">Comments</option>
            </select>

            {(action || targetType) && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setAction("");
                  setTargetType("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0">
          {isLoading && <AuditSkeleton />}

          {error && (
            <div className="alert alert-error m-4">
              <span>{error.message}</span>
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="text-center py-12 px-4">
              <History className="w-10 h-10 mx-auto text-base-content/30 mb-3" />
              <p className="font-medium">No entries</p>
              <p className="text-sm text-base-content/60 mt-1">
                {action || targetType
                  ? "Try clearing the filters."
                  : "Actions will appear here once users start working."}
              </p>
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <>
              <ul className="divide-y divide-base-200">
                {entries.map((e) => {
                  const Icon = ACTION_ICONS[e.action] || FileText;
                  const color = ACTION_COLORS[e.action] || "text-base-content";
                  return (
                    <li
                      key={e._id}
                      className="p-4 hover:bg-base-200/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg bg-base-200 flex items-center justify-center shrink-0 ${color}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold">
                              {e.action}
                            </span>
                            {e.targetType && (
                              <span className="badge badge-xs badge-outline">
                                {e.targetType}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-base-content/60 mt-1">
                            {e.actorEmail ? (
                              <>
                                by{" "}
                                <span className="font-medium text-base-content/80">
                                  {e.actorEmail}
                                </span>
                                {e.actorRole && (
                                  <span className="ml-1 text-base-content/40">
                                    ({e.actorRole})
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="italic">system</span>
                            )}
                            <span className="mx-1.5">·</span>
                            {new Date(e.at).toLocaleString()}
                          </p>

                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <details className="mt-1.5">
                              <summary className="text-xs text-base-content/50 cursor-pointer hover:text-base-content/80">
                                metadata
                              </summary>
                              <pre className="mt-1 text-[11px] bg-base-200/60 rounded p-2 overflow-x-auto">
                                {JSON.stringify(e.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              <div className="flex items-center justify-between gap-3 p-4 border-t border-base-200">
                <span className="text-xs text-base-content/60">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <div className="join">
                  <button
                    className="btn btn-sm join-item gap-1"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </button>
                  <button
                    className="btn btn-sm join-item gap-1"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
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

function AuditSkeleton() {
  return (
    <div className="divide-y divide-base-200">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-4 flex items-start gap-3">
          <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}
