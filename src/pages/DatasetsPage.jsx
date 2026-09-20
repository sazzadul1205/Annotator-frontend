// src/pages/DatasetsPage.jsx
import { useEffect, useRef, useState } from "react";
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
import { getDatasetDisplayStatus, statusLabel } from "../lib/datasetStatus";

function DatasetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [uploads, setUploads] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const fileInputRef = useRef(null);

  const hasActiveUpload = uploads.some(
    (u) =>
      u.status === "uploading" ||
      u.status === "processing" ||
      u.status === "pending",
  );

  const {
    data,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["datasets"],
    // includeCounts makes the API return a `summary` per dataset, which the
    // status badge needs to show annotation progress instead of the raw
    // import status ("completed" only once every comment is annotated).
    queryFn: () => listDatasets({ includeCounts: true }),
    refetchInterval: hasActiveUpload ? 2000 : false,
  });

  const datasets = data?.datasets || [];

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const annotators = (usersData?.users || []).filter(
    (u) => u.role === "annotator" && u.isActive,
  );

  const annotatorName = (id) =>
    annotators.find((u) => u._id === id)?.name || "(removed)";

  const updateUpload = (id, patch) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  };

  const removeUpload = (id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const pollDataset = async (datasetId, uploadId) => {
    const maxAttempts = 80;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1500));

      try {
        const res = await getDataset(datasetId);
        const s = res?.dataset?.status;

        if (s === "completed") {
          updateUpload(uploadId, {
            status: "completed",
            importedRows: res.dataset.importedRows,
            skippedRows: res.dataset.skippedRows,
          });
          queryClient.invalidateQueries({ queryKey: ["datasets"] });
          return;
        }

        if (s === "failed") {
          updateUpload(uploadId, {
            status: "failed",
            error: res.dataset.importError || "Import failed",
          });
          return;
        }

        updateUpload(uploadId, { status: "processing" });
      } catch {
        // swallow polling hiccups
      }
    }

    updateUpload(uploadId, {
      status: "failed",
      error: "Timed out while polling",
    });
  };

  const startUpload = async (file, uploadId) => {
    try {
      const res = await importDataset(file, "", (pct) => {
        updateUpload(uploadId, { progress: pct });
      });

      updateUpload(uploadId, {
        status: "processing",
        datasetId: res.datasetId,
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

  // Open the preview modal instead of uploading directly
  const queueFiles = (files) => {
    if (!files.length) return;
    setPreviewFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Called by ImportPreviewModal when the user confirms
  const confirmPreviewImport = (file) => {
    setPreviewFile(null);

    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newUpload = {
      id: uploadId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
      datasetId: null,
      error: "",
      importedRows: 0,
      skippedRows: 0,
      _file: file,
    };

    setUploads((prev) => [...prev, newUpload]);
    startUpload(file, uploadId);
  };

  const handleFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    queueFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!isAdmin) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /\.(csv|xlsx)$/i.test(f.name),
    );
    queueFiles(files);
  };

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

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Datasets
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage, assign, and export your annotation datasets.
          </p>
        </div>
        <div className="badge badge-outline badge-lg self-start sm:self-auto">
          {datasets.length} {datasets.length === 1 ? "dataset" : "datasets"}
        </div>
      </div>

      {/* Upload card */}
      {isAdmin && (
        <div className="card bg-base-100 shadow-sm border border-base-200 mb-6">
          <div className="card-body p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm sm:text-base">
                  Upload datasets
                </h2>
                <p className="text-xs text-base-content/60">
                  CSV or XLSX · you'll see a preview before importing
                </p>
              </div>
            </div>

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

            {/* Upload queue */}
            {uploads.length > 0 && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-base-content/60">
                    {uploads.filter((u) => u.status === "completed").length} of{" "}
                    {uploads.length} finished
                  </span>
                  {uploads.some(
                    (u) => u.status === "completed" || u.status === "failed",
                  ) && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setUploads((prev) =>
                          prev.filter(
                            (u) =>
                              u.status !== "completed" && u.status !== "failed",
                          ),
                        )
                      }
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
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {u.status === "completed" && (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          )}
                          {u.status === "failed" && (
                            <AlertCircle className="w-4 h-4 text-error shrink-0" />
                          )}
                          {u.status === "processing" && (
                            <span className="loading loading-spinner loading-xs text-info" />
                          )}
                          {u.status === "uploading" && (
                            <Upload className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">
                            {u.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs ${
                              u.status === "failed"
                                ? "text-error"
                                : "text-base-content/60"
                            }`}
                          >
                            {u.status === "uploading" &&
                              `Uploading ${u.progress}%`}
                            {u.status === "processing" && "Processing…"}
                            {u.status === "completed" &&
                              `Done · ${u.importedRows} imported${
                                u.skippedRows > 0
                                  ? `, ${u.skippedRows} skipped`
                                  : ""
                              }`}
                            {u.status === "failed" && u.error}
                          </span>
                          {(u.status === "completed" ||
                            u.status === "failed") && (
                            <button
                              className="btn btn-xs btn-ghost btn-circle"
                              onClick={() => removeUpload(u.id)}
                              aria-label="Remove upload"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {u.status === "uploading" && (
                        <progress
                          className="progress progress-primary w-full h-1"
                          value={u.progress}
                          max="100"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Datasets list */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0 sm:p-2">
          {isLoading && <DatasetsTableSkeleton rows={5} />}

          {listError && (
            <div className="alert alert-error text-sm m-4">
              <span>{listError.message}</span>
            </div>
          )}

          {!isLoading && datasets.length === 0 && (
            <div className="text-center py-16 px-4">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-base-content/30 mb-3" />
              <p className="font-medium">No datasets yet</p>
              <p className="text-sm text-base-content/60 mt-1">
                {isAdmin
                  ? "Upload a CSV or XLSX file to get started."
                  : "Check back later."}
              </p>
            </div>
          )}

          {!isLoading && datasets.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="table table-zebra">
                  <thead className="sticky top-0 bg-base-100 z-10">
                    <tr>
                      <th>Name</th>
                      <th>File</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((ds) => {
                      const isDeleting = deletingId === ds._id;
                      const isDuplicating = duplicatingId === ds._id;
                      const isExporting = exportingId === ds._id;
                      const isAssigning = assigningId === ds._id;
                      const anyBusy =
                        isDeleting ||
                        isDuplicating ||
                        isExporting ||
                        isAssigning;

                      return (
                        <tr
                          key={ds._id}
                          className={isDeleting ? "opacity-50" : ""}
                        >
                          <td className="font-medium">
                            {ds.name}
                            {ds.duplicatedFrom && (
                              <span className="badge badge-ghost badge-xs ml-2">
                                copy
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-base-content/60">
                            {ds.originalFileName}
                          </td>
                          <td>
                            <StatusBadge
                              status={getDatasetDisplayStatus(ds, ds.summary)}
                            />
                          </td>
                          <td className="text-xs">
                            {ds.assignedTo ? (
                              <span className="badge badge-outline badge-sm">
                                {annotatorName(ds.assignedTo)}
                              </span>
                            ) : (
                              <span className="text-base-content/40">—</span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <RowActions
                              ds={ds}
                              isAdmin={isAdmin}
                              annotators={annotators}
                              isDeleting={isDeleting}
                              isDuplicating={isDuplicating}
                              isExporting={isExporting}
                              isAssigning={isAssigning}
                              anyBusy={anyBusy}
                              onExport={handleExport}
                              onAssign={handleAssign}
                              onRename={setRenameTarget}
                              onDuplicate={handleDuplicate}
                              onDelete={handleDelete}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="lg:hidden divide-y divide-base-200">
                {datasets.map((ds) => {
                  const isDeleting = deletingId === ds._id;
                  const isDuplicating = duplicatingId === ds._id;
                  const isExporting = exportingId === ds._id;
                  const isAssigning = assigningId === ds._id;
                  const anyBusy =
                    isDeleting || isDuplicating || isExporting || isAssigning;

                  return (
                    <div
                      key={ds._id}
                      className={`p-4 ${isDeleting ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{ds.name}</h3>
                            {ds.duplicatedFrom && (
                              <span className="badge badge-ghost badge-xs">
                                copy
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-base-content/60 truncate mt-0.5">
                            {ds.originalFileName}
                          </p>
                        </div>
                        <StatusBadge
                          status={getDatasetDisplayStatus(ds, ds.summary)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="flex flex-col">
                          <span className="text-base-content/50">Rows</span>
                          <span className="font-medium">
                            {ds.importedRows}/{ds.totalRows}
                            {ds.skippedRows > 0 && (
                              <span className="text-warning ml-1">
                                ({ds.skippedRows} skipped)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base-content/50">Assigned</span>
                          <span className="font-medium truncate">
                            {ds.assignedTo ? (
                              annotatorName(ds.assignedTo)
                            ) : (
                              <span className="text-base-content/40">—</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col col-span-2">
                          <span className="text-base-content/50">Created</span>
                          <span className="font-medium">
                            {new Date(ds.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        <RowActions
                          ds={ds}
                          isAdmin={isAdmin}
                          annotators={annotators}
                          isDeleting={isDeleting}
                          isDuplicating={isDuplicating}
                          isExporting={isExporting}
                          isAssigning={isAssigning}
                          anyBusy={anyBusy}
                          onExport={handleExport}
                          onAssign={handleAssign}
                          onRename={setRenameTarget}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rename modal */}
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

      {/* Import preview modal */}
      {previewFile && (
        <ImportPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onConfirm={confirmPreviewImport}
        />
      )}
    </div>
  );
}

export default DatasetsPage;

/* ---------------------------------------------------------------- */
/* Row actions                                                       */
/* ---------------------------------------------------------------- */
function RowActions({
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
      <Link to={`/datasets/${ds._id}`} className="btn btn-xs btn-ghost gap-1">
        <Eye className="w-3.5 h-3.5" />
        View
      </Link>

      <button
        ref={exportBtnRef}
        className="btn btn-xs btn-ghost gap-1"
        disabled={ds.status !== "completed" || isExporting}
        onClick={() => toggleMenu("export")}
      >
        {isExporting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {isExporting ? "Exporting" : "Export"}
      </button>

      {isAdmin && (
        <button
          ref={actionsBtnRef}
          className="btn btn-xs btn-ghost gap-1"
          disabled={anyBusy}
          aria-label="More actions"
          onClick={() => toggleMenu("actions")}
        >
          {anyBusy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <MoreVertical className="w-3.5 h-3.5" />
          )}
          Actions
        </button>
      )}

      {exportMenu}
      {actionsMenu}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Skeleton                                                          */
/* ---------------------------------------------------------------- */
function DatasetsTableSkeleton({ rows = 5 }) {
  const skeletonRows = Array.from({ length: rows });

  return (
    <div className="p-4">
      <div className="hidden lg:block">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>File</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Assigned</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {skeletonRows.map((_, i) => (
              <tr key={i}>
                <td>
                  <div className="skeleton h-4 w-32" />
                </td>
                <td>
                  <div className="skeleton h-3 w-40" />
                </td>
                <td>
                  <div className="skeleton h-5 w-20 rounded-full" />
                </td>
                <td>
                  <div className="skeleton h-3 w-16" />
                </td>
                <td>
                  <div className="skeleton h-5 w-24 rounded-full" />
                </td>
                <td>
                  <div className="skeleton h-3 w-28" />
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <div className="skeleton h-6 w-14 rounded-md" />
                    <div className="skeleton h-6 w-14 rounded-md" />
                    <div className="skeleton h-6 w-20 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden divide-y divide-base-200">
        {skeletonRows.map((_, i) => (
          <div key={i} className="py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-32" />
              </div>
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full col-span-2" />
            </div>
            <div className="flex gap-1">
              <div className="skeleton h-6 w-16 rounded-md" />
              <div className="skeleton h-6 w-16 rounded-md" />
              <div className="skeleton h-6 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Rename modal                                                     */
/* ---------------------------------------------------------------- */
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

/* ---------------------------------------------------------------- */
/* Status badge                                                     */
/* ---------------------------------------------------------------- */
function StatusBadge({ status }) {
  const map = {
    pending: "badge-warning",
    processing: "badge-info",
    in_progress: "badge-info",
    completed: "badge-success",
    failed: "badge-error",
  };

  return (
    <span className={`badge ${map[status] || "badge-ghost"} badge-sm`}>
      {statusLabel(status)}
    </span>
  );
}
