// src/pages/DatasetsPage.jsx
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Upload,
  Eye,
  Download,
  Pencil,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import {
  listDatasets,
  importDataset,
  renameDataset,
  deleteDataset,
  getDataset,
} from "../services/datasetApi";
import { exportComments } from "../services/commentApi";
import { useAuth } from "../context/useAuth";


export default function DatasetsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [error, setError] = useState("");
  const [pollId, setPollId] = useState(null);
  const [toast, setToast] = useState("");
  const [exportingId, setExportingId] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch datasets (auto-refresh while a poll is active)
  const {
    data,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => listDatasets(),
    refetchInterval: pollId ? 1500 : false,
  });

  const datasets = data?.datasets || [];

  // Poll the newly uploaded dataset until completed/failed
  const { data: pollData } = useQuery({
    queryKey: ["dataset", pollId],
    queryFn: () => getDataset(pollId),
    enabled: !!pollId,
    refetchInterval: (query) => {
      const s = query.state.data?.dataset?.status;
      return s === "completed" || s === "failed" ? false : 1500;
    },
  });

  // React to polling result
  if (pollData?.dataset) {
    const s = pollData.dataset.status;
    if (s === "completed" && pollId) {
      setUploadMsg(
        `Import completed: ${pollData.dataset.importedRows} imported, ${pollData.dataset.skippedRows} skipped`,
      );
      setPollId(null);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    }
    if (s === "failed" && pollId) {
      setError(pollData.dataset.importError || "Import failed");
      setPollId(null);
      setUploading(false);
    }
  }

  // ---- Upload ----
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadMsg("");
    setProgress(0);
    setUploading(true);

    try {
      const res = await importDataset(file, "", setProgress);
      setPollId(res.datasetId);
      setUploadMsg("Import started, polling...");
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
      setUploading(false);
    } finally {
      // allow same file re-upload
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- Rename ----
  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => renameDataset(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["datasets"] }),
  });

  const handleRename = (ds) => {
    const name = window.prompt("New name:", ds.name);
    if (!name || name === ds.name) return;
    renameMutation.mutate({ id: ds._id, name });
  };

  // ---- Delete ----
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDataset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["datasets"] }),
  });

  const handleDelete = (ds) => {
    const ok = window.confirm(
      `Delete "${ds.name}"?\nThis removes all its comments and history.`,
    );
    if (ok) deleteMutation.mutate(ds._id);
  };

  // ---- Export ----
  const handleExport = async (ds, format) => {
    setError("");
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

      // Show toast immediately after starting the download
      setToast(`Download started: ${filename}`);
      setTimeout(() => setToast(""), 3000);

      // Clean up on the next tick — after the browser has begun the download
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="alert alert-success gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Datasets</h1>
      </div>

      {/* Upload card (admin only) */}
      {isAdmin && (
        <div className="card bg-base-100 shadow-sm mb-6">
          <div className="card-body">
            <h2 className="card-title text-base gap-2">
              <Upload className="w-4 h-4" />
              Upload CSV / XLSX
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="file-input file-input-bordered w-full max-w-md"
              onChange={handleUpload}
              disabled={uploading}
            />

            {uploading && (
              <div className="mt-3">
                <progress
                  className="progress progress-primary w-full max-w-md"
                  value={progress}
                  max="100"
                />
                <p className="text-xs text-base-content/60 mt-1">
                  Upload: {progress}%
                </p>
              </div>
            )}

            {uploadMsg && (
              <div className="alert alert-info text-sm mt-3 py-2">
                <span>{uploadMsg}</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error text-sm mt-3 py-2">
                <span>{error}</span>
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
                  {datasets.map((ds) => (
                    <tr key={ds._id}>
                      <td className="font-medium">{ds.name}</td>
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
                            assigned
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

                        {/* Export dropdown */}
                        <div className="dropdown dropdown-end inline-block">
                          <button
                            tabIndex={0}
                            className="btn btn-xs btn-ghost gap-1"
                            disabled={
                              ds.status !== "completed" ||
                              exportingId === ds._id
                            }
                          >
                            {exportingId === ds._id ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {exportingId === ds._id ? "Exporting" : "Export"}
                          </button>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu bg-base-100 rounded-box z-10 w-32 p-2 shadow"
                          >
                            <li>
                              <button
                                className="gap-2"
                                disabled={exportingId === ds._id}
                                onClick={() => handleExport(ds, "csv")}
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                CSV
                              </button>
                            </li>
                            <li>
                              <button
                                className="gap-2"
                                disabled={exportingId === ds._id}
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
                            <button
                              className="btn btn-xs btn-ghost gap-1"
                              onClick={() => handleRename(ds)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Rename
                            </button>
                            <button
                              className="btn btn-xs btn-ghost text-error gap-1"
                              onClick={() => handleDelete(ds)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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