// src/services/mediaApi.js
// Client for the media (image / video) annotation domain.
//
// The important thing to know about this API, because it shapes everything in
// the UI: media bytes are NOT served statically. `GET /media/assets/:id/file`
// requires the same bearer token as every other endpoint, so it cannot be used
// as a plain <img src> or <video src>. Everything that needs the actual pixels
// must fetch the bytes through this module and turn them into an object URL —
// see `useAssetObjectUrl`.
//
// The response shapes below are the real ones, verified against the running
// API; note that the COCO export is returned *unwrapped*, while YOLO and the
// other endpoints are wrapped in { success, data }.
import api from "./api";

/* ------------------------------------------------------------------ */
/* Label sets                                                          */
/* ------------------------------------------------------------------ */

export const listLabelSets = (includeInactive = false) =>
  api
    .get("/media/label-sets", { params: { includeInactive } })
    .then((r) => r.data.data);

export const createLabelSet = (payload) =>
  api.post("/media/label-sets", payload).then((r) => r.data.data);

export const updateLabelSet = (id, payload) =>
  api.patch(`/media/label-sets/${id}`, payload).then((r) => r.data.data);

export const deleteLabelSet = (id) =>
  api.delete(`/media/label-sets/${id}`).then((r) => r.data.data);

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

export const listMediaDatasets = (params) =>
  api.get("/media/datasets", { params }).then((r) => r.data.data);

export const getMediaDataset = (id) =>
  api.get(`/media/datasets/${id}`).then((r) => r.data.data);

export const createMediaDataset = (payload) =>
  api.post("/media/datasets", payload).then((r) => r.data.data);

export const updateMediaDataset = (id, payload) =>
  api.patch(`/media/datasets/${id}`, payload).then((r) => r.data.data);

export const deleteMediaDataset = (id) =>
  api.delete(`/media/datasets/${id}`).then((r) => r.data.data);

export const getMediaDatasetStats = (id) =>
  api.get(`/media/datasets/${id}/stats`).then((r) => r.data.data);

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const listMediaAssets = (datasetId, params) =>
  api
    .get(`/media/datasets/${datasetId}/assets`, { params })
    .then((r) => r.data.data);

export const getMediaAsset = (id) =>
  api.get(`/media/assets/${id}`).then((r) => r.data.data);

export const assignMediaAsset = (id, assignedTo) =>
  api.patch(`/media/assets/${id}`, { assignedTo }).then((r) => r.data.data);

export const deleteMediaAsset = (id) =>
  api.delete(`/media/assets/${id}`).then((r) => r.data.data);

/**
 * Uploads one or more files to a media dataset.
 *
 * A partial success is a real outcome, not an error: the API answers 207 and
 * names the files it refused. That is why this returns the parsed body instead
 * of relying on axios to throw, and why the caller has to look at `failed`.
 *
 * @param {string} datasetId
 * @param {File[]} files
 * @param {Function} [onProgress] - upload progress callback (0..100)
 */
export const uploadMediaAssets = async (datasetId, files, onProgress) => {
  const form = new FormData();
  for (const f of files) form.append("files", f);

  const r = await api.post(`/media/datasets/${datasetId}/assets`, form, {
    // Videos are large; the default 30s axios timeout is not enough.
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });

  return { ...r.data.data, status: r.status };
};

/**
 * Fetches an asset's bytes.
 *
 * Must go through axios rather than a plain URL so the Authorization header is
 * attached; a browser loading the URL directly would get a 401.
 */
export const fetchMediaAssetBlob = (id, onProgress, signal) =>
  api.get(`/media/assets/${id}/file`, {
    responseType: "blob",
    timeout: 0,
    signal,
    onDownloadProgress: onProgress,
  });

/* ------------------------------------------------------------------ */
/* Annotations                                                         */
/* ------------------------------------------------------------------ */

export const listAssetAnnotations = (assetId) =>
  api.get(`/media/assets/${assetId}/annotations`).then((r) => r.data.data);

export const listDatasetAnnotations = (datasetId, params) =>
  api
    .get(`/media/datasets/${datasetId}/annotations`, { params })
    .then((r) => r.data.data);

export const createAnnotation = (assetId, payload) =>
  api
    .post(`/media/assets/${assetId}/annotations`, payload)
    .then((r) => r.data.data);

export const updateAnnotation = (id, payload) =>
  api.patch(`/media/annotations/${id}`, payload).then((r) => r.data.data);

export const deleteAnnotation = (id) =>
  api.delete(`/media/annotations/${id}`).then((r) => r.data.data);

export const annotationHistory = (id) =>
  api.get(`/media/annotations/${id}/history`).then((r) => r.data.data);

export const restoreAnnotation = (id) =>
  api.post(`/media/annotations/${id}/restore`).then((r) => r.data.data);

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetches an export and hands back a Blob plus a filename.
 *
 * The endpoint changes content type by format — COCO is bare JSON, CSV is
 * text, YOLO is a { filename: contents } map — so everything is normalised to a
 * download here rather than in each page.
 */
export const exportMediaDataset = async (datasetId, format, params = {}) => {
  const r = await api.get(`/media/datasets/${datasetId}/export`, {
    params: { format, ...params },
    responseType: "blob",
    timeout: 0,
  });

  const filename =
    format === "yolo"
      ? `${datasetId}-yolo.json`
      : format === "coco"
        ? `${datasetId}-coco.json`
        : `${datasetId}-annotations.csv`;

  // YOLO is a directory, delivered as a JSON map of file -> contents. There is
  // no zip dependency, so the client assembles the files. We surface the map as
  // JSON: the page can offer individual downloads or build a zip.
  const blob =
    format === "yolo" ? new Blob([r.data], { type: "application/json" }) : r.data;

  return { blob, filename, status: r.status };
};

/** Parses the YOLO map so the UI can list and download its individual files. */
export const parseYoloPayload = async (blob) => {
  const text = await blob.text();
  return JSON.parse(text);
};
