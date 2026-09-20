// src/services/analyticsApi.js
import api from "./api";

/** Full analytics for one dataset. */
export const getDatasetAnalytics = (datasetId) =>
  api.get(`/analytics/dataset/${datasetId}`).then((r) => r.data);

/** Global analytics (admin dashboard). */
export const getGlobalAnalytics = () =>
  api.get("/analytics/global").then((r) => r.data);

/**
 * Download ML-ready split.
 * @param {string} datasetId
 * @param {"jsonl"|"csv"|"xlsx"} format
 * @param {string} [split] e.g. "0.8,0.1,0.1"
 */
export const exportMLData = (datasetId, format = "jsonl", split) => {
  const params = { format };
  if (split) params.split = split;
  return api
    .get(`/analytics/dataset/${datasetId}/export-ml`, {
      params,
      responseType: "blob",
    })
    .then((r) => r.data);
};
