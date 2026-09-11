// React
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Icons
import {
  Upload,
  Eye,
  Download,
  Pencil,
  Trash2,
  FileSpreadsheet,
  UserPlus,
  UserMinus,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";

// Services
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

// Context
import { useAuth } from "../context/useAuth";

// Lib
import {
  toast,
  alertError,
  alertSuccess,
  confirmDelete,
} from "../lib/swal";

function DatasetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  // Component state
  const [uploads, setUploads] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  // File input reference
  const fileInputRef = useRef(null);

  // Check if any upload is still being processed
  const hasActiveUpload = uploads.some(
    (u) =>
      u.status === "uploading" ||
      u.status === "processing" ||
      u.status === "pending",
  );

  // Fetch datasets and refresh while uploads are active
  const { data, isLoading, error: listError } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => listDatasets(),
    refetchInterval: hasActiveUpload ? 2000 : false,
  });

  // Get datasets from the API response
  const datasets = data?.datasets || [];

  // Fetch users only for admins
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  // Get active annotators
  const annotators = (usersData?.users || []).filter(
    (u) => u.role === "annotator" && u.isActive,
  );

  // Get an annotator's name from their ID
  const annotatorName = (id) =>
    annotators.find((u) => u._id === id)?.name || "(removed)";

  // Update an upload in the local queue
  const updateUpload = (id, patch) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  };

  // Remove an upload from the queue
  const removeUpload = (id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  // Check the dataset status until processing is finished
  const pollDataset = async (datasetId, uploadId) => {
    const maxAttempts = 80;

    for (let i = 0; i < maxAttempts; i++) {
      // Wait before checking the status again
      await new Promise((r) => setTimeout(r, 1500));

      try {
        const res = await getDataset(datasetId);
        const s = res?.dataset?.status;

        // Import completed successfully
        if (s === "completed") {
          updateUpload(uploadId, {
            status: "completed",
            importedRows: res.dataset.importedRows,
            skippedRows: res.dataset.skippedRows,
          });

          queryClient.invalidateQueries({ queryKey: ["datasets"] });
          return;
        }

        // Import failed on the server
        if (s === "failed") {
          updateUpload(uploadId, {
            status: "failed",
            error: res.dataset.importError || "Import failed",
          });
          return;
        }

        // Dataset is still being processed
        updateUpload(uploadId, { status: "processing" });
      } catch {
        // Ignore temporary polling errors and try again
      }
    }

    // Stop polling if the maximum attempts are reached
    updateUpload(uploadId, {
      status: "failed",
      error: "Timed out while polling",
    });
  };

  // Upload a file and start dataset processing
  const startUpload = async (file, uploadId) => {
    try {
      // Upload the file and update progress
      const res = await importDataset(file, "", (pct) => {
        updateUpload(uploadId, { progress: pct });
      });

      // Mark the upload as processing
      updateUpload(uploadId, {
        status: "processing",
        datasetId: res.datasetId,
      });

      queryClient.invalidateQueries({ queryKey: ["datasets"] });

      // Wait for the dataset import to finish
      pollDataset(res.datasetId, uploadId);
    } catch (err) {
      // Show upload errors in the queue
      updateUpload(uploadId, {
        status: "failed",
        error: err?.response?.data?.error || err.message || "Upload failed",
      });
    }
  };

  // Handle files selected from the file picker
  const handleFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Create queue entries for each selected file
    const newUploads = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
      datasetId: null,
      error: "",
      importedRows: 0,
      skippedRows: 0,
      _file: file,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Start uploading each selected file
    for (const u of newUploads) {
      startUpload(u._file, u.id);
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Delete a dataset
  const handleDelete = async (ds) => {
    const ok = await confirmDelete(
      `Delete "${ds.name}"?`,
      "This removes all its comments and history. This cannot be undone.",
    );
    if (!ok) return;

    setDeletingId(ds._id);

    try {
      await deleteDataset(ds._id);

      // Refresh the dataset list after deletion
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    } catch (err) {
      alertError("Delete failed", err?.response?.data?.error || err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Assign or unassign a dataset
  const handleAssign = async (ds, assignedTo) => {
    if ((ds.assignedTo || null) === (assignedTo || null)) return;

    setAssigningId(ds._id);

    try {
      await assignDataset(ds._id, assignedTo);

      // Refresh the list after assignment
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

  // Create a copy of a dataset
  const handleDuplicate = async (ds) => {
    setDuplicatingId(ds._id);

    try {
      const res = await duplicateDataset(ds._id, `${ds.name} (copy)`);

      // Refresh the list to show the new dataset
      queryClient.invalidateQueries({ queryKey: ["datasets"] });

      alertSuccess(
        "Duplicated",
        `Created "${ds.name} (copy)" with ${res.copiedComments} comments.`,
      );
    } catch (err) {
      alertError(
        "Duplicate failed",
        err?.response?.data?.error || err.message,
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  // Export dataset comments
  const handleExport = async (ds, format) => {
    setExportingId(ds._id);

    try {
      // Request the exported file from the backend
      const blob = await exportComments({ datasetId: ds._id, format });
      const url = URL.createObjectURL(blob);

      // Create a filename based on the dataset name
      const filename = `${ds.name.replace(/\s+/g, "_")}.${format}`;

      // Trigger the browser download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      toast(`Download started: ${filename}`);

      // Clean up the temporary download elements
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Datasets</h1>
      </div>

      {/* Upload card */}
      {isAdmin && (
        <div className="card bg-base-100 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title text-base gap-2">
              <Upload className="w-4 h-4" />
              Upload CSV / XLSX
              <span className="text-xs font-normal text-base-content/50">
                (select one or many)
              </span>
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              multiple
              className="file-input file-input-bordered w-full max-w-md"
              onChange={handleFilePick}
            />

            {uploads.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-base-content/60">
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
                                u.status !== "completed" &&
                                u.status !== "failed",
                            ),
                          )
                        }
                      >
                        Clear finished
                      </button>
                    )}
                </div>

                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="border border-base-300 rounded-lg p-2"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {u.status === "completed" && (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        )}
                        {u.status === "failed" && (
                          <AlertCircle className="w-4 h-4 text-error shrink-0" />
                        )}
                        {u.status === "processing" && (
                          <span className="loading loading-spinner loading-xs" />
                        )}
                        {u.status === "uploading" && (
                          <Upload className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">
                          {u.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-base-content/60">
                          {u.status === "uploading" &&
                            `Uploading ${u.progress}%`}
                          {u.status === "processing" && "Processing..."}
                          {u.status === "completed" &&
                            `Done · ${u.importedRows} imported${u.skippedRows > 0
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
            )}
          </div>
        </div>
      )}

      {/* Datasets list */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {isLoading && (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner" />
            </div>
          )}

          {listError && (
            <div className="alert alert-error text-sm">
              <span>{listError.message}</span>
            </div>
          )}

          {!isLoading && datasets.length === 0 && (
            <p className="text-center text-base-content/60 py-6">
              No datasets yet.
            </p>
          )}

          {datasets.length > 0 && (
            <div>
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
                  {datasets.map((ds) => {
                    const isDeleting = deletingId === ds._id;
                    const isDuplicating = duplicatingId === ds._id;
                    const isExporting = exportingId === ds._id;
                    const isAssigning = assigningId === ds._id;
                    const anyBusy =
                      isDeleting || isDuplicating || isExporting || isAssigning;

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
                          <StatusBadge status={ds.status} />
                        </td>
                        <td className="text-sm">
                          {ds.importedRows}/{ds.totalRows}
                          {ds.skippedRows > 0 && (
                            <span className="text-xs text-warning ml-1">
                              ({ds.skippedRows} skipped)
                            </span>
                          )}
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
                        <td className="text-xs">
                          {new Date(ds.createdAt).toLocaleString()}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <Link
                            to={`/datasets/${ds._id}`}
                            className="btn btn-xs btn-ghost gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Link>

                          {/* Export */}
                          <div className="dropdown dropdown-end inline-block">
                            <button
                              tabIndex={0}
                              className="btn btn-xs btn-ghost gap-1"
                              disabled={
                                ds.status !== "completed" || isExporting
                              }
                            >
                              {isExporting ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              {isExporting ? "Exporting" : "Export"}
                            </button>
                            <ul
                              tabIndex={0}
                              className="dropdown-content menu bg-base-100 rounded-box z-10 w-32 p-2 shadow"
                            >
                              <li>
                                <button
                                  className="gap-2"
                                  disabled={isExporting}
                                  onClick={() => handleExport(ds, "csv")}
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                  CSV
                                </button>
                              </li>
                              <li>
                                <button
                                  className="gap-2"
                                  disabled={isExporting}
                                  onClick={() => handleExport(ds, "xlsx")}
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                  XLSX
                                </button>
                              </li>
                            </ul>
                          </div>

                          {isAdmin && (
                            <>
                              {/* Assign */}
                              <div className="dropdown dropdown-end inline-block">
                                <button
                                  tabIndex={0}
                                  className="btn btn-xs btn-ghost gap-1"
                                  disabled={isAssigning || anyBusy}
                                >
                                  {isAssigning ? (
                                    <span className="loading loading-spinner loading-xs" />
                                  ) : (
                                    <UserPlus className="w-3.5 h-3.5" />
                                  )}
                                  Assign
                                </button>
                                <ul
                                  tabIndex={0}
                                  className="dropdown-content menu bg-base-100 rounded-box z-10 w-56 p-2 shadow"
                                >
                                  <li className="menu-title text-xs">
                                    Assign to
                                  </li>

                                  {annotators.length === 0 && (
                                    <li className="disabled">
                                      <span>No annotators</span>
                                    </li>
                                  )}

                                  {annotators.map((u) => {
                                    const isCurrent =
                                      ds.assignedTo === u._id;
                                    return (
                                      <li key={u._id}>
                                        <button
                                          onClick={() =>
                                            handleAssign(ds, u._id)
                                          }
                                          disabled={isCurrent}
                                          className={
                                            isCurrent ? "active" : ""
                                          }
                                        >
                                          <span className="flex items-center gap-2">
                                            {u.name}
                                            {isCurrent && (
                                              <span className="badge badge-xs badge-primary">
                                                current
                                              </span>
                                            )}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}

                                  {ds.assignedTo && (
                                    <>
                                      <div className="divider my-1"></div>
                                      <li>
                                        <button
                                          onClick={() =>
                                            handleAssign(ds, null)
                                          }
                                          className="text-error gap-2"
                                        >
                                          <UserMinus className="w-3.5 h-3.5" />
                                          Unassign
                                        </button>
                                      </li>
                                    </>
                                  )}
                                </ul>
                              </div>

                              {/* Rename */}
                              <button
                                className="btn btn-xs btn-ghost gap-1"
                                onClick={() => setRenameTarget(ds)}
                                disabled={anyBusy}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Rename
                              </button>

                              {/* Duplicate */}
                              <button
                                className="btn btn-xs btn-ghost gap-1"
                                onClick={() => handleDuplicate(ds)}
                                disabled={
                                  ds.status !== "completed" || anyBusy
                                }
                                title="Create a copy of this dataset and its comments"
                              >
                                {isDuplicating ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                {isDuplicating ? "Copying" : "Duplicate"}
                              </button>

                              {/* Delete */}
                              <button
                                className="btn btn-xs btn-ghost text-error gap-1"
                                onClick={() => handleDelete(ds)}
                                disabled={anyBusy}
                              >
                                {isDeleting ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                {isDeleting ? "Deleting" : "Delete"}
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
          )}
        </div>
      </div>

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
    </div>
  );
}

export default DatasetsPage;

// Rename Dataset Modal
function RenameDatasetModal({ dataset, onClose, onDone, onError }) {
  // Track the rename request state
  const [loading, setLoading] = useState(false);

  // Set up form state and validation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: dataset.name },
  });

  // Submit the new dataset name
  const onSubmit = async (values) => {
    const trimmed = values.name.trim();

    // Close without making a request if the name hasn't changed
    if (trimmed === dataset.name) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      // Update the dataset name
      await renameDataset(dataset._id, { name: trimmed });
      onDone();
    } catch (err) {
      // Show the error returned by the API
      onError(err?.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Rename Dataset
          </h3>

          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text">New name</span>
            </label>

            <input
              type="text"
              className="input input-bordered w-full"
              autoFocus
              {...register("name", {
                required: "Name is required",
                validate: (v) =>
                  v.trim().length > 0 || "Name cannot be empty",
              })}
            />

            {/* Show validation error or the original name */}
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

      {/* Prevent closing while the rename request is running */}
      <div
        className="modal-backdrop"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}

// Display a badge based on the dataset status
function StatusBadge({ status }) {
  const map = {
    pending: "badge-warning",
    processing: "badge-info",
    completed: "badge-success",
    failed: "badge-error",
  };

  return (
    <span className={`badge ${map[status] || "badge-ghost"} badge-sm`}>
      {status}
    </span>
  );
}