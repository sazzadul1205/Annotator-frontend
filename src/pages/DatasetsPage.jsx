// src/pages/DatasetsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Upload,
  Eye,
  Download,
  Pencil,
  Trash2,
  FileSpreadsheet,
  UserMinus,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  MoreVertical,
  FileUp,
  Plus,
  User,
  Inbox,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  listDatasets,
  importDataset,
  renameDataset,
  deleteDataset,
  getDataset,
  assignDataset,
  duplicateDataset,
} from "../services/datasetApi";
import { listUsers } from "../services/userApi";
import { exportComments } from "../services/commentApi";

import ImportPreviewModal from "../components/ImportPreviewModal";

import { useAuth } from "../context/useAuth";
import { toast, alertError, alertSuccess, confirmDelete } from "../lib/swal";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "ready", label: "Ready" },
  { id: "unassigned", label: "Unassigned" },
  { id: "complete", label: "Complete" },
  { id: "failed", label: "Failed" },
];

const PAGE_SIZES = [10, 20, 50];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getDisplayStatus(ds) {
  const s = ds.status;
  if (s === "pending" || s === "processing") return "importing";
  if (s === "failed") return "failed";

  const summary = ds.summary || { total: 0, annotated: 0, pending: 0 };
  if (summary.total === 0) return "empty";
  if (summary.annotated === summary.total) return "complete";
  if (!ds.assignedTo) return "unassigned";
  if (summary.annotated === 0) return "ready";
  return "in_progress";
}

function getProgress(ds) {
  const s = ds.summary;
  if (!s || !s.total) return 0;
  return Math.round((s.annotated / s.total) * 100);
}

function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  return Number(n).toLocaleString();
}

function phaseLabel(phase) {
  switch (phase) {
    case "parsing":
      return "Parsing file…";
    case "inserting":
      return "Inserting comments";
    case "versions":
      return "Writing history";
    case "finalizing":
      return "Finalizing…";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return "Processing…";
  }
}

function formatEta(ms) {
  if (!ms || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `~${s}s left`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `~${m}m ${rs}s left`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `~${h}h ${rm}m left`;
}

/* ------------------------------------------------------------------ */
/* Live progress bar for uploads                                       */
/* ------------------------------------------------------------------ */

function ProcessingProgress({ progress, eta }) {
  const phase = progress?.phase || "parsing";
  const processed = progress?.processed || 0;
  const total = progress?.total || 0;

  const hasCounts = total > 0;
  const pct = hasCounts ? Math.round((processed / total) * 100) : 0;
  const etaText = formatEta(eta);

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-base-content/60">{phaseLabel(phase)}</span>
        <div className="flex items-center gap-2 tabular-nums text-base-content/50">
          {hasCounts && (
            <span>
              {processed.toLocaleString()} / {total.toLocaleString()}
            </span>
          )}
          {etaText && (
            <>
              <span className="text-base-content/20">·</span>
              <span>{etaText}</span>
            </>
          )}
        </div>
      </div>

      {hasCounts ? (
        <progress
          className="progress progress-info w-full h-1.5"
          value={pct}
          max="100"
        />
      ) : (
        // Indeterminate: no `value` attribute gives the animated bar
        <progress className="progress progress-info w-full h-1.5" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DatasetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [uploads, setUploads] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const listTopRef = useRef(null);
  // Stores the previous progress sample per upload for ETA calculation
  const uploadRefs = useRef({});

  const activeUploadCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "processing",
  ).length;

  const hasActiveUpload = activeUploadCount > 0;

  /* ---------------------------------------------------------------- */
  /* Data                                                              */
  /* ---------------------------------------------------------------- */

  const {
    data,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => listDatasets({ includeCounts: true }),
    refetchInterval: hasActiveUpload ? 2000 : false,
  });

  const datasets = useMemo(() => data?.datasets || [], [data]);

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const annotators = useMemo(
    () =>
      (usersData?.users || []).filter(
        (u) => u.role === "annotator" && u.isActive,
      ),
    [usersData],
  );

  const annotatorName = (id) =>
    annotators.find((u) => u._id === id)?.name || "(removed)";

  /* ---------------------------------------------------------------- */
  /* Derived counts + filtering                                        */
  /* ---------------------------------------------------------------- */

  const counts = useMemo(() => {
    const c = {
      all: datasets.length,
      importing: 0,
      in_progress: 0,
      ready: 0,
      unassigned: 0,
      complete: 0,
      failed: 0,
      empty: 0,
    };
    for (const ds of datasets) {
      const key = getDisplayStatus(ds);
      if (c[key] !== undefined) c[key] += 1;
    }
    return c;
  }, [datasets]);

  const visibleDatasets = useMemo(() => {
    if (filter === "all") return datasets;
    return datasets.filter((ds) => getDisplayStatus(ds) === filter);
  }, [datasets, filter]);

  /* ---------------------------------------------------------------- */
  /* Pagination                                                        */
  /* ---------------------------------------------------------------- */

  const totalVisible = visibleDatasets.length;
  const totalPages = Math.max(1, Math.ceil(totalVisible / pageSize));
  const currentPage = Math.min(page, totalPages);

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalVisible);
  const pageItems = visibleDatasets.slice(startIdx, endIdx);

  const showingFrom = totalVisible === 0 ? 0 : startIdx + 1;
  const showingTo = endIdx;

  const handleFilterChange = (filterId) => {
    setFilter(filterId);
    setPage(1);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const goToPage = (p) => {
    if (p === currentPage) return;
    setPage(p);
    if (listTopRef.current) {
      const yOffset = -80;
      const y =
        listTopRef.current.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  /* ---------------------------------------------------------------- */
  /* Uploads                                                           */
  /* ---------------------------------------------------------------- */

  const updateUpload = (id, patch) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  };

  const removeUpload = (id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
    delete uploadRefs.current[id];
  };

  const clearFinishedUploads = () => {
    setUploads((prev) => {
      const kept = prev.filter(
        (u) => u.status !== "completed" && u.status !== "failed",
      );
      // Clean up refs for removed uploads
      const keptIds = new Set(kept.map((u) => u.id));
      for (const id of Object.keys(uploadRefs.current)) {
        if (!keptIds.has(id)) delete uploadRefs.current[id];
      }
      return kept;
    });
  };

  const pollDataset = async (datasetId, uploadId) => {
    const maxAttempts = 400; // ~10 min at 1s interval

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      try {
        const res = await getDataset(datasetId);
        const s = res?.dataset?.status;
        const p = res?.dataset?.progress || null;

        if (s === "completed") {
          updateUpload(uploadId, {
            status: "completed",
            importedRows: res.dataset.importedRows,
            skippedRows: res.dataset.skippedRows,
            renamedRows: res.dataset.renamedRows || 0,
            progress: null,
            eta: null,
          });
          delete uploadRefs.current[uploadId];
          queryClient.invalidateQueries({ queryKey: ["datasets"] });
          return;
        }

        if (s === "failed") {
          updateUpload(uploadId, {
            status: "failed",
            error: res.dataset.importError || "Import failed",
            progress: null,
            eta: null,
          });
          delete uploadRefs.current[uploadId];
          return;
        }

        // -------- Still processing: extract progress + compute ETA --------
        const now = Date.now();
        const prev = uploadRefs.current[uploadId] || null;

        let eta = null;
        if (prev && p && p.processed > 0 && p.total > 0) {
          const deltaProcessed = p.processed - (prev.processed || 0);
          const deltaTime = now - (prev.sampledAt || now);

          if (deltaProcessed > 0 && deltaTime > 500) {
            const ratePerMs = deltaProcessed / deltaTime;
            const remaining = p.total - p.processed;
            if (ratePerMs > 0 && remaining > 0) {
              eta = Math.round(remaining / ratePerMs); // ms
            }
          }
        }

        updateUpload(uploadId, {
          status: "processing",
          progress: p
            ? {
                phase: p.phase,
                processed: p.processed || 0,
                total: p.total || 0,
                startedAt: p.startedAt ? new Date(p.startedAt).getTime() : null,
              }
            : null,
          eta,
        });

        // Remember this sample for the next ETA computation
        uploadRefs.current[uploadId] = {
          processed: p ? p.processed || 0 : 0,
          sampledAt: now,
        };
      } catch {
        // swallow transient polling hiccups
      }
    }

    updateUpload(uploadId, {
      status: "failed",
      error: "Timed out while polling",
      progress: null,
      eta: null,
    });
    delete uploadRefs.current[uploadId];
  };

  const startUpload = async (file, uploadId, options = {}) => {
    const { dedupeStrategy = "skip", datasetName = "" } = options;

    try {
      const res = await importDataset(
        file,
        datasetName,
        (pct) => {
          updateUpload(uploadId, { uploadPct: pct });
        },
        dedupeStrategy,
      );

      updateUpload(uploadId, {
        status: "processing",
        datasetId: res.datasetId,
        uploadPct: 100,
      });

      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      pollDataset(res.datasetId, uploadId);
    } catch (err) {
      updateUpload(uploadId, {
        status: "failed",
        error: err?.response?.data?.error || err.message || "Upload failed",
      });
    }
  };

  const queueFiles = (files) => {
    if (!files.length) return;
    setPreviewFile(files[0]);
  };

  const confirmPreviewImport = (file, options = {}) => {
    setPreviewFile(null);

    const dedupeStrategy = options.dedupeStrategy || "skip";
    const datasetName = (options.name || "").trim();

    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newUpload = {
      id: uploadId,
      name: file.name,
      datasetName: datasetName || file.name.replace(/\.(csv|xlsx)$/i, ""),
      size: file.size,
      uploadPct: 0,
      status: "uploading",
      datasetId: null,
      error: "",
      importedRows: 0,
      skippedRows: 0,
      renamedRows: 0,
      progress: null,
      eta: null,
      dedupeStrategy,
      _file: file,
    };

    setUploads((prev) => [...prev, newUpload]);

    // Clear any stale sample for this upload id
    delete uploadRefs.current[uploadId];

    startUpload(file, uploadId, { dedupeStrategy, datasetName });
  };

  /* ---------------------------------------------------------------- */
  /* Dataset actions                                                   */
  /* ---------------------------------------------------------------- */

  const handleDelete = async (ds) => {
    const ok = await confirmDelete(
      `Delete "${ds.name}"?`,
      "This removes all its comments and history. This cannot be undone.",
    );
    if (!ok) return;

    setDeletingId(ds._id);
    try {
      await deleteDataset(ds._id);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    } catch (err) {
      alertError("Delete failed", err?.response?.data?.error || err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssign = async (ds, assignedTo) => {
    if ((ds.assignedTo || null) === (assignedTo || null)) return;

    setAssigningId(ds._id);
    try {
      await assignDataset(ds._id, assignedTo);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });

      alertSuccess(
        "Done",
        assignedTo
          ? `Assigned to ${annotatorName(assignedTo)}`
          : "Dataset unassigned",
      );
    } catch (err) {
      alertError("Assign failed", err?.response?.data?.error || err.message);
    } finally {
      setAssigningId(null);
    }
  };

  const handleDuplicate = async (ds) => {
    setDuplicatingId(ds._id);
    try {
      const res = await duplicateDataset(ds._id, `${ds.name} (copy)`);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });

      alertSuccess(
        "Duplicated",
        `Created "${ds.name} (copy)" with ${res.copiedComments} comments.`,
      );
    } catch (err) {
      alertError("Duplicate failed", err?.response?.data?.error || err.message);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleExport = async (ds, format) => {
    setExportingId(ds._id);
    try {
      const blob = await exportComments({ datasetId: ds._id, format });
      const url = URL.createObjectURL(blob);
      const filename = `${ds.name.replace(/\s+/g, "_")}.${format}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      toast(`Download started: ${filename}`);

      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      alertError("Export failed", err?.response?.data?.error || err.message);
    } finally {
      setExportingId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-6xl mx-auto">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Datasets
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {counts.all === 0
              ? "No datasets yet."
              : `${formatNumber(counts.all)} dataset${
                  counts.all === 1 ? "" : "s"
                }${
                  counts.in_progress + counts.ready > 0
                    ? ` · ${counts.in_progress + counts.ready} in progress`
                    : ""
                }`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {activeUploadCount > 0 && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="btn btn-sm btn-ghost gap-1.5 text-info hover:bg-info/10"
                title="View running imports"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {activeUploadCount} importing
              </button>
            )}
            <button
              className="btn btn-primary btn-sm gap-2 shadow-sm"
              onClick={() => setImportModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Import
            </button>
          </div>
        )}
      </div>

      {/* ---------- Filter pills ---------- */}
      {!isLoading && counts.all > 0 && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
          {FILTERS.map((f) => {
            const count = counts[f.id] ?? 0;
            if (count === 0 && f.id !== "all") return null;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={`btn btn-sm rounded-full normal-case font-normal shrink-0 ${
                  active ? "btn-primary" : "btn-ghost"
                }`}
              >
                {f.label}
                <span
                  className={`badge badge-xs ${
                    active ? "badge-primary-content" : "badge-ghost"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- List ---------- */}
      <div ref={listTopRef} />

      {isLoading && <DatasetsListSkeleton rows={5} />}

      {listError && (
        <div className="alert alert-error text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{listError.message}</span>
        </div>
      )}

      {!isLoading && !listError && counts.all === 0 && (
        <EmptyState
          isAdmin={isAdmin}
          onImport={() => setImportModalOpen(true)}
        />
      )}

      {!isLoading && counts.all > 0 && totalVisible === 0 && (
        <div className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body items-center text-center py-12">
            <Inbox className="w-10 h-10 text-base-content/30 mb-2" />
            <p className="font-medium">Nothing in this view</p>
            <p className="text-sm text-base-content/60 mt-1">
              No datasets match the "{filter}" filter.
            </p>
            <button
              className="btn btn-ghost btn-sm mt-3"
              onClick={() => handleFilterChange("all")}
            >
              Show all
            </button>
          </div>
        </div>
      )}

      {!isLoading && pageItems.length > 0 && (
        <div className="space-y-3">
          {pageItems.map((ds) => (
            <DatasetCard
              key={ds._id}
              ds={ds}
              isAdmin={isAdmin}
              annotators={annotators}
              annotatorName={annotatorName}
              isDeleting={deletingId === ds._id}
              isDuplicating={duplicatingId === ds._id}
              isExporting={exportingId === ds._id}
              isAssigning={assigningId === ds._id}
              anyBusy={
                deletingId === ds._id ||
                duplicatingId === ds._id ||
                exportingId === ds._id ||
                assigningId === ds._id
              }
              onExport={handleExport}
              onAssign={handleAssign}
              onRename={setRenameTarget}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ---------- Pagination ---------- */}
      {!isLoading && totalVisible > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalVisible}
          showingFrom={showingFrom}
          showingTo={showingTo}
          pageSize={pageSize}
          onPageChange={goToPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* ---------- Modals ---------- */}
      {isAdmin && importModalOpen && (
        <ImportModal
          uploads={uploads}
          onClose={() => setImportModalOpen(false)}
          onFiles={queueFiles}
          onRemoveUpload={removeUpload}
          onClearFinished={clearFinishedUploads}
        />
      )}

      {renameTarget && (
        <RenameDatasetModal
          dataset={renameTarget}
          onClose={() => setRenameTarget(null)}
          onDone={() => {
            setRenameTarget(null);
            queryClient.invalidateQueries({ queryKey: ["datasets"] });
            alertSuccess("Done", "Dataset renamed.");
          }}
          onError={(msg) => alertError("Rename failed", msg)}
        />
      )}

      {previewFile && (
        <ImportPreviewModal
          key={`${previewFile.name}-${previewFile.size}-${previewFile.lastModified}`}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onConfirm={confirmPreviewImport}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination bar                                                      */
/* ------------------------------------------------------------------ */

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  showingFrom,
  showingTo,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const pageNumbers = useMemo(() => {
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
  }, [currentPage, totalPages]);

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 text-xs text-base-content/60 order-2 sm:order-1">
        <span className="tabular-nums whitespace-nowrap">
          Showing <strong className="text-base-content">{showingFrom}</strong>–
          <strong className="text-base-content">{showingTo}</strong> of{" "}
          <strong className="text-base-content">
            {totalItems.toLocaleString()}
          </strong>
        </span>

        <div className="hidden sm:flex items-center gap-2 ml-2">
          <span className="whitespace-nowrap">Rows per page</span>
          <select
            className="select select-bordered select-xs w-18"
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
          className="btn btn-sm btn-ghost btn-square"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          className="btn btn-sm btn-ghost btn-square"
          disabled={isFirst}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-0.5 mx-1">
          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="w-8 text-center text-base-content/40 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`btn btn-sm min-w-8 px-2 normal-case font-normal tabular-nums ${
                  p === currentPage ? "btn-primary" : "btn-ghost"
                }`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <span className="sm:hidden px-3 text-sm tabular-nums">
          <strong>{currentPage}</strong>
          <span className="text-base-content/40"> / {totalPages}</span>
        </span>

        <button
          className="btn btn-sm btn-ghost btn-square"
          disabled={isLast}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          className="btn btn-sm btn-ghost btn-square"
          disabled={isLast}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dataset card                                                        */
/* ------------------------------------------------------------------ */

function DatasetCard({
  ds,
  isAdmin,
  annotators,
  annotatorName,
  isDeleting,
  isDuplicating,
  isExporting,
  isAssigning,
  anyBusy,
  onExport,
  onAssign,
  onRename,
  onDuplicate,
  onDelete,
}) {
  const status = getDisplayStatus(ds);
  const progress = getProgress(ds);
  const summary = ds.summary || { total: 0, annotated: 0, pending: 0 };

  return (
    <article
      className={`card bg-base-100 border border-base-200 shadow-sm transition-opacity ${
        isDeleting ? "opacity-50" : ""
      }`}
    >
      <div className="card-body p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base truncate">
                    {ds.name}
                  </h3>
                  {ds.duplicatedFrom && (
                    <span className="badge badge-ghost badge-xs">copy</span>
                  )}
                </div>
                <p className="text-xs text-base-content/50 truncate mt-0.5">
                  {ds.originalFileName}
                </p>
              </div>

              <StatusChip status={status} />
            </div>
          </div>
        </div>

        {/* Live import progress inside the card */}
        {status === "importing" && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-base-content/60 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {ds.progress?.phase
                  ? phaseLabel(ds.progress.phase)
                  : "Importing…"}
              </span>
              {ds.progress?.total > 0 && (
                <span className="tabular-nums text-base-content/50">
                  {(ds.progress.processed || 0).toLocaleString()} /{" "}
                  {(ds.progress.total || 0).toLocaleString()}
                </span>
              )}
            </div>
            {ds.progress?.total > 0 ? (
              <progress
                className="progress progress-info w-full h-1.5"
                value={ds.progress.processed || 0}
                max={ds.progress.total || 1}
              />
            ) : (
              <progress className="progress progress-info w-full h-1.5" />
            )}
          </div>
        )}

        {/* Annotation progress (after import done) */}
        {status !== "importing" && status !== "failed" && (
          <div className="mt-4">
            {summary.total === 0 ? (
              <div className="text-xs text-base-content/50 italic">
                No comments yet
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-base-content/60">
                    <strong className="text-base-content">
                      {formatNumber(summary.annotated)}
                    </strong>{" "}
                    / {formatNumber(summary.total)} annotated
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      progress === 100 ? "text-success" : "text-base-content/70"
                    }`}
                  >
                    {progress}%
                  </span>
                </div>

                <progress
                  className={`progress w-full h-2 ${
                    progress === 100 ? "progress-success" : "progress-primary"
                  }`}
                  value={summary.annotated}
                  max={summary.total || 1}
                />

                <div className="flex items-center gap-3 text-xs text-base-content/50 mt-1.5">
                  {summary.pending > 0 && (
                    <span>{formatNumber(summary.pending)} pending</span>
                  )}
                  {ds.renamedRows > 0 && (
                    <span className="text-warning">
                      {formatNumber(ds.renamedRows)} renamed
                    </span>
                  )}
                  {ds.skippedRows > 0 && (
                    <span className="text-warning">
                      {formatNumber(ds.skippedRows)} skipped
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {status === "failed" && (
          <div className="mt-4 flex items-start gap-2 text-sm text-error">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="truncate">
              {ds.importError || "Import failed"}
            </span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-base-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-base-content/60 min-w-0">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {ds.assignedTo ? (
                annotatorName(ds.assignedTo)
              ) : (
                <span className="italic text-base-content/40">Unassigned</span>
              )}
            </span>
          </div>

          <DatasetActions
            ds={ds}
            isAdmin={isAdmin}
            annotators={annotators}
            isDeleting={isDeleting}
            isDuplicating={isDuplicating}
            isExporting={isExporting}
            isAssigning={isAssigning}
            anyBusy={anyBusy}
            onExport={onExport}
            onAssign={onAssign}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Dataset actions                                                     */
/* ------------------------------------------------------------------ */

function DatasetActions({
  ds,
  isAdmin,
  annotators,
  isDeleting,
  isDuplicating,
  isExporting,
  anyBusy,
  onExport,
  onAssign,
  onRename,
  onDuplicate,
  onDelete,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const exportBtnRef = useRef(null);
  const actionsBtnRef = useRef(null);
  const menuRef = useRef(null);

  const computeMenuStyle = (btnEl, menuWidth, menuHeight) => {
    if (!btnEl) return null;
    const rect = btnEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12;

    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );

    return openUp
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
        };
  };

  const openWith = (menuName) => {
    const btnEl =
      menuName === "export" ? exportBtnRef.current : actionsBtnRef.current;
    const menuWidth = menuName === "export" ? 144 : 224;
    const menuHeight = menuName === "export" ? 100 : 340;
    setMenuStyle(computeMenuStyle(btnEl, menuWidth, menuHeight));
    setOpenMenu(menuName);
  };

  const toggleMenu = (menuName) => {
    if (openMenu === menuName) {
      setOpenMenu(null);
      setMenuStyle(null);
    } else {
      openWith(menuName);
    }
  };

  const closeMenu = () => {
    setOpenMenu(null);
    setMenuStyle(null);
  };

  useEffect(() => {
    if (!openMenu) return;

    const onDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (
        exportBtnRef.current?.contains(e.target) ||
        actionsBtnRef.current?.contains(e.target)
      )
        return;
      closeMenu();
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    const onScrollOrResize = () => closeMenu();

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
  }, [openMenu]);

  const isExportOpen = openMenu === "export";
  const isActionsOpen = openMenu === "actions";

  const exportMenu =
    isExportOpen &&
    menuStyle &&
    createPortal(
      <div
        ref={menuRef}
        style={menuStyle}
        className="menu bg-base-100 rounded-box p-2 shadow-lg border border-base-200"
      >
        <button
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-base-200 text-left text-sm disabled:opacity-40"
          disabled={isExporting}
          onClick={() => {
            closeMenu();
            onExport(ds, "csv");
          }}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          CSV
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-base-200 text-left text-sm disabled:opacity-40"
          disabled={isExporting}
          onClick={() => {
            closeMenu();
            onExport(ds, "xlsx");
          }}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          XLSX
        </button>
      </div>,
      document.body,
    );

  const actionsMenu =
    isActionsOpen &&
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
            <div className="px-3 py-2 text-sm opacity-50">No annotators</div>
          )}
          {annotators.map((u) => {
            const isCurrent = ds.assignedTo === u._id;
            return (
              <button
                key={u._id}
                disabled={isCurrent}
                onClick={() => {
                  closeMenu();
                  onAssign(ds, u._id);
                }}
                className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded text-left text-sm ${
                  isCurrent ? "bg-primary/10 text-primary" : "hover:bg-base-200"
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

        {ds.assignedTo && (
          <>
            <div className="divider my-1"></div>
            <button
              onClick={() => {
                closeMenu();
                onAssign(ds, null);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm text-error hover:bg-error/10"
            >
              <UserMinus className="w-3.5 h-3.5" />
              Unassign
            </button>
          </>
        )}

        <div className="divider my-1"></div>

        <button
          onClick={() => {
            closeMenu();
            onRename(ds);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm hover:bg-base-200"
        >
          <Pencil className="w-3.5 h-3.5" />
          Rename
        </button>

        <button
          disabled={ds.status !== "completed"}
          onClick={() => {
            closeMenu();
            onDuplicate(ds);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm hover:bg-base-200 disabled:opacity-40"
        >
          {isDuplicating ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          Duplicate
        </button>

        <button
          onClick={() => {
            closeMenu();
            onDelete(ds);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-sm text-error hover:bg-error/10"
        >
          {isDeleting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Delete
        </button>
      </div>,
      document.body,
    );

  return (
    <>
      <Link
        to={`/datasets/${ds._id}`}
        className="btn btn-xs btn-ghost gap-1 normal-case"
      >
        <Eye className="w-3.5 h-3.5" />
        View
      </Link>

      <button
        ref={exportBtnRef}
        className="btn btn-xs btn-ghost gap-1 normal-case"
        disabled={ds.status !== "completed" || isExporting}
        onClick={() => toggleMenu("export")}
      >
        {isExporting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Export
      </button>

      {isAdmin && (
        <button
          ref={actionsBtnRef}
          className="btn btn-xs btn-ghost btn-square"
          disabled={anyBusy}
          aria-label="More actions"
          onClick={() => toggleMenu("actions")}
        >
          {anyBusy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <MoreVertical className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {exportMenu}
      {actionsMenu}
    </>
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
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ isAdmin, onImport }) {
  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body items-center text-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold">No datasets yet</h2>
        <p className="text-sm text-base-content/60 mt-1 max-w-sm">
          {isAdmin
            ? "Import a CSV or XLSX file to start annotating."
            : "Check back later — your assigned datasets will appear here."}
        </p>

        {isAdmin && (
          <button className="btn btn-primary gap-2 mt-5" onClick={onImport}>
            <Upload className="w-4 h-4" />
            Import your first dataset
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Import modal                                                        */
/* ------------------------------------------------------------------ */

function ImportModal({
  uploads,
  onClose,
  onFiles,
  onRemoveUpload,
  onClearFinished,
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    onFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /\.(csv|xlsx)$/i.test(f.name),
    );
    onFiles(files);
  };

  const completedCount = uploads.filter((u) => u.status === "completed").length;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl p-0">
        <div className="flex items-center justify-between p-5 border-b border-base-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Import datasets</h3>
              <p className="text-xs text-base-content/50">
                CSV or XLSX · you'll preview before importing
              </p>
            </div>
          </div>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors p-6 sm:p-8 text-center ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-base-300 hover:border-primary/50 hover:bg-base-200/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <FileUp className="w-8 h-8 mx-auto mb-2 text-base-content/40" />
            <p className="text-sm font-medium">
              Click to browse or drag & drop
            </p>
            <p className="text-xs text-base-content/50 mt-1">
              Supported formats: .csv, .xlsx
            </p>
          </div>

          {uploads.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-base-content/60">
                  {completedCount} of {uploads.length} finished
                </span>
                {uploads.some(
                  (u) => u.status === "completed" || u.status === "failed",
                ) && (
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={onClearFinished}
                  >
                    Clear finished
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="border border-base-200 rounded-lg p-3 bg-base-100"
                  >
                    {/* Row 1: icon + name + status text */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {u.status === "completed" && (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        )}
                        {u.status === "failed" && (
                          <AlertCircle className="w-4 h-4 text-error shrink-0" />
                        )}
                        {u.status === "processing" && (
                          <Loader2 className="w-4 h-4 text-info shrink-0 animate-spin" />
                        )}
                        {u.status === "uploading" && (
                          <Upload className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">
                          {u.datasetName || u.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs tabular-nums ${
                            u.status === "failed"
                              ? "text-error"
                              : "text-base-content/60"
                          }`}
                        >
                          {u.status === "uploading" &&
                            `Uploading ${u.uploadPct || 0}%`}
                          {u.status === "processing" &&
                            phaseLabel(u.progress?.phase)}
                          {u.status === "completed" &&
                            `Done · ${u.importedRows} imported${
                              u.skippedRows > 0
                                ? `, ${u.skippedRows} skipped`
                                : ""
                            }${
                              u.renamedRows > 0
                                ? `, ${u.renamedRows} renamed`
                                : ""
                            }`}
                          {u.status === "failed" && u.error}
                        </span>
                        {(u.status === "completed" ||
                          u.status === "failed") && (
                          <button
                            className="btn btn-xs btn-ghost btn-circle"
                            onClick={() => onRemoveUpload(u.id)}
                            aria-label="Remove upload"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: progress bar */}
                    {u.status === "uploading" && (
                      <progress
                        className="progress progress-primary w-full h-1.5"
                        value={u.uploadPct || 0}
                        max="100"
                      />
                    )}

                    {u.status === "processing" && (
                      <ProcessingProgress progress={u.progress} eta={u.eta} />
                    )}

                    {u.status === "completed" && (
                      <progress
                        className="progress progress-success w-full h-1.5"
                        value="100"
                        max="100"
                      />
                    )}

                    {u.status === "failed" && (
                      <progress
                        className="progress progress-error w-full h-1.5"
                        value="100"
                        max="100"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-base-200 bg-base-200/40">
          <button className="btn btn-ghost" onClick={onClose}>
            {uploads.some(
              (u) => u.status === "uploading" || u.status === "processing",
            )
              ? "Close"
              : "Done"}
          </button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rename modal                                                        */
/* ------------------------------------------------------------------ */

function RenameDatasetModal({ dataset, onClose, onDone, onError }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: dataset.name },
  });

  const onSubmit = async (values) => {
    const trimmed = values.name.trim();

    if (trimmed === dataset.name) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await renameDataset(dataset._id, { name: trimmed });
      onDone();
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Rename Dataset
          </h3>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text">New name</span>
            </label>

            <input
              type="text"
              className={`input input-bordered w-full ${
                errors.name ? "input-error" : ""
              }`}
              autoFocus
              {...register("name", {
                required: "Name is required",
                validate: (v) => v.trim().length > 0 || "Name cannot be empty",
              })}
            />

            {errors.name ? (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.name.message}
                </span>
              </label>
            ) : (
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  Was: {dataset.name}
                </span>
              </label>
            )}
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  Rename
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div
        className="modal-backdrop"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function DatasetsListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="card bg-base-100 border border-base-200 shadow-sm"
        >
          <div className="card-body p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="skeleton w-10 h-10 sm:w-11 sm:h-11 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-4 w-48" />
                    <div className="skeleton h-3 w-32" />
                  </div>
                  <div className="skeleton h-5 w-24 rounded-full shrink-0" />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <div className="skeleton h-3 w-40" />
                <div className="skeleton h-3 w-10" />
              </div>
              <div className="skeleton h-2 w-full rounded-full" />
            </div>

            <div className="mt-4 pt-4 border-t border-base-200 flex items-center justify-between">
              <div className="skeleton h-3 w-24" />
              <div className="flex gap-1">
                <div className="skeleton h-6 w-16 rounded-md" />
                <div className="skeleton h-6 w-16 rounded-md" />
                <div className="skeleton h-6 w-8 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
