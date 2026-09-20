// src/components/ImportPreviewModal.jsx
import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  AlertTriangle,
  X,
  Upload,
  Info,
} from "lucide-react";
import { previewImport } from "../services/datasetApi";

export default function ImportPreviewModal({ file, onClose, onConfirm }) {
  // One request result, tagged with the file it belongs to. The view state is
  // derived from that tag instead of being reset inside the effect, so the effect
  // body never calls setState synchronously (react-hooks/set-state-in-effect) and
  // a new `file` prop automatically invalidates the previous result.
  const [result, setResult] = useState({
    file: null,
    preview: null,
    error: "",
    loading: true,
  });

  const isCurrentFile = result.file === file;
  const loading = !isCurrentFile || result.loading;
  const preview = isCurrentFile ? result.preview : null;
  const error = isCurrentFile ? result.error : "";

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
                  color="error"
                />
              </div>

              {/* Already imported warning */}
              {preview.alreadyImported && (
                <div className="alert alert-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <div>
                    <p className="font-medium text-sm">
                      This exact file was already imported
                    </p>
                    <p className="text-xs opacity-80">
                      Dataset "{preview.alreadyImported.name}" has the same
                      checksum. Importing again will be rejected by the server.
                    </p>
                  </div>
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
        <div className="flex justify-end gap-2 p-5 border-t border-base-200 bg-base-200/40">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary gap-2"
            onClick={() => onConfirm(file)}
            disabled={loading || !preview || preview.validRows === 0}
          >
            <Upload className="w-4 h-4" />
            Import {preview?.validRows || 0} rows
          </button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}

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
