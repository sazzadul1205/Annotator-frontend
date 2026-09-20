// src/lib/datasetStatus.js
//
// A dataset document's `status` field tracks the *import* job only:
//   pending -> processing -> completed | failed
// so "completed" means "the file finished importing", NOT "the dataset is fully
// annotated". The UI therefore derives a display status from the annotation
// progress that comes back as `summary` ({ total, annotated, pending }) from
// GET /datasets/:id and GET /datasets?includeCounts=true.

export const IN_PROGRESS = "in_progress";

/**
 * Status shown for a dataset.
 *
 * The import status wins while the file is still being processed (or failed).
 * Once the import is "completed", annotation progress decides:
 *   every comment annotated -> "completed"
 *   anything still pending  -> "in_progress"
 */
export function getDatasetDisplayStatus(dataset, summary) {
  const importStatus = dataset?.status;

  if (importStatus !== "completed") return importStatus;

  const total = summary?.total ?? 0;
  const annotated = summary?.annotated ?? 0;

  return total > 0 && annotated >= total ? "completed" : IN_PROGRESS;
}

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  annotated: "Annotated",
  in_progress: "In Progress",
};

export const statusLabel = (status) => STATUS_LABELS[status] || status;
