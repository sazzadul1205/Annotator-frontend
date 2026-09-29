// src/components/media/UploadDropzone.jsx
// Drag-and-drop or browse-to-upload for a media dataset.
//
// The subtle part is the failure mode. Uploading a folder is a batch, and the
// API answers 207 when it refuses some files: a duplicate checksum, a bad
// extension, a file over the size cap. That is not an error — it is a partial
// success, and the most common case of all, because re-uploading a scrape
// produces duplicates. So the result is reported file by file rather than as
// one green toast or one red error.
import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileWarning, UploadCloud, X } from "lucide-react";
import { uploadMediaAssets } from "../../services/mediaApi";
import { useQueryClient } from "@tanstack/react-query";
import { formatBytes } from "../../lib/format";

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff"];
const VIDEO_EXT = ["mp4", "m4v", "mov", "webm", "mkv", "avi"];

const ACCEPT = [...IMAGE_EXT, ...VIDEO_EXT].map((e) => `.${e}`).join(",");

/** Cheap client-side pre-check. The server is still the authority. */
function looksAcceptable(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext && [...IMAGE_EXT, ...VIDEO_EXT].includes(ext);
}

export default function UploadDropzone({ datasetId, onUploaded }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const upload = useCallback(
    async (files) => {
      if (!files?.length) return;

      // Filter client-side first: uploading a whole batch only to have the
      // server reject one file wastes the bandwidth and the user's time.
      const rejected = files.filter((f) => !looksAcceptable(f));
      const accepted = files.filter((f) => looksAcceptable(f));
      const localFailures = rejected.map((f) => ({
        name: f.name,
        error: `Unsupported type. Accepted: ${ACCEPT.replace(/\./g, " ").replace(/,/g, ", ")}`,
      }));

      if (!accepted.length) {
        setResult({ stored: [], failed: localFailures });
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      setUploading(true);
      setProgress(0);
      try {
        const res = await uploadMediaAssets(datasetId, accepted, setProgress);
        // A batch can be partly rejected locally and partly stored, so the
        // two failure lists are merged rather than one replacing the other.
        setResult({
          stored: res.stored || [],
          failed: [...localFailures, ...(res.failed || [])],
        });
        if (res.stored?.length) {
          queryClient.invalidateQueries({ queryKey: ["media", "dataset", datasetId] });
          onUploaded?.(res);
        }
      } catch (err) {
        setResult({
          stored: [],
          failed: [
            ...localFailures,
            {
              name: "Upload",
              error: err?.response?.data?.error || err.message || "Upload failed",
            },
          ],
        });
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [datasetId, onUploaded, queryClient],
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(Array.from(e.dataTransfer.files || []));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-box p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-base-content/15 hover:border-primary/40 hover:bg-base-200/40"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => upload(Array.from(e.target.files || []))}
        />
        {uploading ? (
          <>
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-sm mt-3">Uploading… {progress}%</p>
            <progress
              className="progress progress-primary w-48 h-1.5 mt-2"
              value={progress}
              max={100}
            />
          </>
        ) : (
          <>
            <UploadCloud className="w-9 h-9 mx-auto text-base-content/30 mb-2" />
            <p className="text-sm font-medium">Drop images or videos here</p>
            <p className="text-xs text-base-content/50 mt-1">
              or click to browse ·{" "}
              {[...IMAGE_EXT.slice(0, 4), ...VIDEO_EXT.slice(0, 3)].join(", ")} and more
            </p>
          </>
        )}
      </div>

      {result && <UploadResult result={result} onDismiss={() => setResult(null)} />}
    </div>
  );
}

function UploadResult({ result, onDismiss }) {
  const stored = result.stored || [];
  const failed = result.failed || [];
  if (stored.length === 0 && failed.length === 0) return null;

  // A partial success is the common case (re-uploading a scrape duplicates
  // files), so it gets its own tone rather than being dressed up as an error.
  const tone =
    failed.length === 0
      ? "alert-success"
      : stored.length === 0
        ? "alert-error"
        : "alert-warning";
  const Icon = failed.length === 0 ? CheckCircle2 : stored.length === 0 ? AlertCircle : FileWarning;

  const totalBytes = stored.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);

  return (
    <div className={`alert ${tone} text-sm items-start`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">
          {stored.length > 0 && `${stored.length} uploaded`}
          {stored.length > 0 && failed.length > 0 && " · "}
          {failed.length > 0 && `${failed.length} rejected`}
          {totalBytes > 0 && ` (${formatBytes(totalBytes)})`}
        </p>
        {failed.length > 0 && (
          <ul className="text-xs space-y-0.5 opacity-90 max-h-32 overflow-y-auto">
            {failed.map((f, i) => (
              <li key={`${f.name}-${i}`} className="truncate">
                <span className="font-mono">{f.name}</span> — {f.error}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="btn btn-ghost btn-xs" onClick={onDismiss} title="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
