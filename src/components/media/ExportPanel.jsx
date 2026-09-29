// src/components/media/ExportPanel.jsx
// Downloads a dataset as COCO, YOLO or CSV.
//
// The three formats do not come back the same way, and pretending otherwise is
// how an export button ends up downloading a JSON file called "coco.json" that
// is actually a directory manifest:
//
//   coco  — the bare COCO object, one file
//   csv   — a single text file
//   yolo  — a *directory* (labels/, classes.txt, data.yaml), which the API
//           returns as a { filename: contents } JSON map because zipping would
//           need a dependency
//
// So YOLO gets a two-step flow: show what is in the archive, let it be fetched
// whole or file by file.
import { useState } from "react";
import {
  AlertCircle,
  Box,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FolderTree,
} from "lucide-react";
import { exportMediaDataset } from "../../services/mediaApi";
import { getErrorMessage } from "../../services/getErrorMessage";
import { toast } from "../../lib/swal";

const FORMATS = [
  {
    id: "coco",
    label: "COCO",
    icon: FileText,
    blurb: "One JSON file. Absolute-pixel boxes, for Detectron2 and MMDetection.",
  },
  {
    id: "yolo",
    label: "YOLO",
    icon: FolderTree,
    blurb: "A directory: labels/, classes.txt, data.yaml. Normalised boxes.",
  },
  {
    id: "csv",
    label: "CSV",
    icon: FileSpreadsheet,
    blurb: "One row per annotation. For spreadsheets and quick inspection.",
  },
];

export default function ExportPanel({ dataset }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [yoloFiles, setYoloFiles] = useState(null);

  const download = async (format) => {
    setBusy(format);
    setError(null);
    try {
      const { blob, filename } = await exportMediaDataset(
        dataset._id,
        format,
        { includeUnannotated: "true" },
      );
      triggerDownload(blob, filename);
      toast(`${format.toUpperCase()} export downloaded`);
      if (format === "yolo") {
        const text = await blob.text();
        setYoloFiles(JSON.parse(text));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const downloadYoloFile = (name, contents) => {
    const isYaml = name.endsWith(".yaml");
    triggerDownload(
      new Blob([contents], { type: isYaml ? "text/yaml" : "text/plain" }),
      name.split("/").pop() || name,
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => download(f.id)}
              disabled={Boolean(busy)}
              className="btn btn-sm btn-outline justify-start gap-2 h-auto py-2.5 text-left normal-case font-normal"
            >
              {busy === f.id ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Icon className="w-4 h-4 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{f.label}</span>
                <span className="block text-[10px] opacity-60 leading-tight mt-0.5 line-clamp-2">
                  {f.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="alert alert-error py-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {yoloFiles && (
        <div className="rounded-box border border-base-content/10 bg-base-200/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              YOLO archive ({Object.keys(yoloFiles).length} files)
            </p>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setYoloFiles(null)}
            >
              hide
            </button>
          </div>
          <p className="text-[10px] text-base-content/50 mb-2">
            Unzipped. Drop the <code>labels/</code> folder,{" "}
            <code>classes.txt</code> and <code>data.yaml</code> next to your
            training script.
          </p>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {Object.entries(yoloFiles).map(([name, contents]) => (
              <button
                key={name}
                type="button"
                onClick={() => downloadYoloFile(name, contents)}
                className="w-full flex items-center gap-2 text-left text-[11px] font-mono px-2 py-1 rounded hover:bg-base-100"
                title="Download this file"
              >
                <Download className="w-3 h-3 shrink-0 opacity-50" />
                <span className="truncate">{name}</span>
                <span className="ml-auto text-[10px] opacity-40 shrink-0">
                  {contents.split("\n").length} lines
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-base-content/45 flex items-start gap-1.5">
        <Check className="w-3 h-3 mt-0.5 shrink-0" />
        Unannotated assets are included so the export always contains the whole
        dataset. Class names and their index order come from this dataset's
        label set, so COCO and YOLO stay consistent with each other.
      </p>
    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick; revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
