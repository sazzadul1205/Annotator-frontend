// src/components/ImportPreviewModal.jsx

// React
import { useEffect, useState } from "react";

// Icons
import {
  FileSpreadsheet,
  AlertTriangle,
  X,
  Upload,
  Info,
  Copy,
  SkipForward,
  Type,
} from "lucide-react";

// Services
import { previewImport } from "../services/datasetApi";

/** "my-file.csv" → "my-file" */
function stripExtension(filename) {
  return String(filename || "").replace(/\.(csv|xlsx)$/i, "");
}

function ImportPreviewModal({ file, onClose, onConfirm }) {
  const [result, setResult] = useState({
    file: null,
    preview: null,
    error: "",
    loading: true,
  });

  // "skip" | "rename"
  const [dedupeStrategy, setDedupeStrategy] = useState("skip");

  // Dataset name — initialized from the file name
  const [name, setName] = useState(() => stripExtension(file?.name));
  const [nameError, setNameError] = useState("");

  const isCurrentFile = result.file === file;
  const loading = !isCurrentFile || result.loading;
  const preview = isCurrentFile ? result.preview : null;
  const error = isCurrentFile ? result.error : "";

  const hasDuplicates = (preview?.duplicates || 0) > 0;

  useEffect(() => {
    let cancelled = false;

    previewImport(file)
      .then((res) => {
        if (cancelled) return;
        setResult({ file, preview: res.preview, error: "", loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({
          file,
          preview: null,
          error: err?.response?.data?.error || err.message || "Preview failed",
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Please enter a dataset name");
      return;
    }
    if (trimmed.length > 120) {
      setNameError("Name is too long (max 120 characters)");
      return;
    }
    setNameError("");
    onConfirm(file, { dedupeStrategy, name: trimmed });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-base-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">Import preview</h3>
              <p className="text-xs text-base-content/50">
                {file?.name} · {(file?.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="space-y-3">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-24 w-full rounded-lg" />
              <div className="skeleton h-6 w-32" />
              <div className="skeleton h-24 w-full rounded-lg" />
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {preview && !loading && (
            <div className="space-y-4">
              {/* Dataset name input */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                    <Type className="w-3 h-3" />
                    Dataset name
                  </span>
                </label>
                <input
                  type="text"
                  className={`input input-bordered w-full ${
                    nameError ? "input-error" : ""
                  }`}
                  placeholder="e.g. Bank Reviews – Q1 2026"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  autoFocus
                  maxLength={150}
                />
                {nameError ? (
                  <label className="label pt-1">
                    <span className="label-text-alt text-error">
                      {nameError}
                    </span>
                  </label>
                ) : (
                  <label className="label pt-1">
                    <span className="label-text-alt text-base-content/50">
                      Defaults to the file name — change it if you like.
                    </span>
                  </label>
                )}
              </div>

              <div className="divider my-1"></div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox
                  label="Total rows"
                  value={preview.totalRows}
                  color="base"
                />
                <StatBox
                  label="Valid"
                  value={preview.validRows}
                  color="success"
                />
                <StatBox
                  label="Missing"
                  value={preview.missingIdOrText}
                  color="warning"
                />
                <StatBox
                  label="Duplicates"
                  value={preview.duplicates}
                  color={hasDuplicates ? "error" : "base"}
                />
              </div>

              {/* Dedupe strategy — only shows when there ARE duplicates */}
              {hasDuplicates && (
                <div className="border border-warning/30 bg-warning/5 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">
                        {preview.duplicates} duplicate row
                        {preview.duplicates === 1 ? "" : "s"} found
                      </p>
                      <p className="text-xs text-base-content/60 mt-0.5">
                        How would you like to handle them?
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pl-6">
                    <label
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        dedupeStrategy === "skip"
                          ? "border-primary bg-primary/5"
                          : "border-base-200 hover:bg-base-200/40"
                      }`}
                    >
                      <input
                        type="radio"
                        className="radio radio-primary radio-sm mt-0.5"
                        name="dedupeStrategy"
                        value="skip"
                        checked={dedupeStrategy === "skip"}
                        onChange={(e) => setDedupeStrategy(e.target.value)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <SkipForward className="w-3.5 h-3.5 text-base-content/60" />
                          <span className="text-sm font-medium">
                            Skip duplicates
                          </span>
                        </div>
                        <p className="text-xs text-base-content/60 mt-0.5">
                          Only the first occurrence of each ID is imported.
                          Later ones are dropped.{" "}
                          <span className="text-base-content/80">
                            {preview.validRows} rows will import.
                          </span>
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        dedupeStrategy === "rename"
                          ? "border-primary bg-primary/5"
                          : "border-base-200 hover:bg-base-200/40"
                      }`}
                    >
                      <input
                        type="radio"
                        className="radio radio-primary radio-sm mt-0.5"
                        name="dedupeStrategy"
                        value="rename"
                        checked={dedupeStrategy === "rename"}
                        onChange={(e) => setDedupeStrategy(e.target.value)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Copy className="w-3.5 h-3.5 text-base-content/60" />
                          <span className="text-sm font-medium">
                            Keep all — rename duplicates
                          </span>
                        </div>
                        <p className="text-xs text-base-content/60 mt-0.5">
                          Duplicates get{" "}
                          <code className="px-1 py-0.5 rounded bg-base-200 text-[11px]">
                            -dup1
                          </code>
                          ,{" "}
                          <code className="px-1 py-0.5 rounded bg-base-200 text-[11px]">
                            -dup2
                          </code>
                          , etc. appended to their ID.{" "}
                          <span className="text-base-content/80">
                            {preview.validRows + preview.duplicates} rows will
                            import.
                          </span>
                        </p>
                      </div>
                    </label>
                  </div>

                  {preview.duplicateIds?.length > 0 && (
                    <div className="mt-3 pl-6">
                      <p className="text-[11px] text-base-content/50 mb-1">
                        Duplicate IDs (first {preview.duplicateIds.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preview.duplicateIds.map((id) => (
                          <span
                            key={id}
                            className="badge badge-sm badge-ghost font-mono text-[10px]"
                          >
                            {id}
                          </span>
                        ))}
                        {preview.duplicates > preview.duplicateIds.length && (
                          <span className="badge badge-sm badge-ghost text-[10px]">
                            +{preview.duplicates - preview.duplicateIds.length}{" "}
                            more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sample */}
              {preview.sample?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-base-content/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Sample (first {preview.sample.length})
                  </h4>
                  <div className="space-y-2">
                    {preview.sample.map((s, i) => (
                      <div
                        key={i}
                        className="border border-base-200 rounded-lg p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-base-content/60">
                            {s.sourceId}
                          </span>
                          {s.sentiment && (
                            <span className="badge badge-xs">
                              {s.sentiment}
                            </span>
                          )}
                          {s.type && (
                            <span className="badge badge-xs">{s.type}</span>
                          )}
                        </div>
                        <p className="text-base-content/80">{s.commentText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {preview.errors?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-base-content/60 uppercase tracking-wider mb-2">
                    Preview errors
                  </h4>
                  <div className="bg-error/5 border border-error/20 rounded-lg p-3 text-xs space-y-1 font-mono">
                    {preview.errors.map((e, i) => (
                      <div key={i} className="text-error">
                        {e}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-5 border-t border-base-200 bg-base-200/40">
          <p className="text-xs text-base-content/60 min-w-0 truncate pr-2">
            {preview && !loading ? (
              dedupeStrategy === "rename" && hasDuplicates ? (
                <>
                  <strong className="text-base-content">
                    {preview.validRows + preview.duplicates}
                  </strong>{" "}
                  rows will be imported (with renamed duplicates)
                </>
              ) : (
                <>
                  <strong className="text-base-content">
                    {preview.validRows}
                  </strong>{" "}
                  rows will be imported
                </>
              )
            ) : (
              " "
            )}
          </p>

          <div className="flex gap-2 shrink-0">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary gap-2"
              onClick={handleConfirm}
              disabled={loading || !preview || preview.validRows === 0}
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>
      </div>

      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}

export default ImportPreviewModal;

// Stat Box
function StatBox({ label, value, color = "base" }) {
  const colorClass = {
    base: "border-base-200 bg-base-100",
    success: "border-success/20 bg-success/5 text-success",
    warning: "border-warning/20 bg-warning/5 text-warning",
    error: "border-error/20 bg-error/5 text-error",
  }[color];

  return (
    <div className={`border rounded-lg p-3 ${colorClass}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
