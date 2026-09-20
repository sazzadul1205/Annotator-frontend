// src/services/datasetApi.js
import api from "./api";

export const listDatasets = (params) =>
  api.get("/datasets", { params }).then((r) => r.data);

export const getDataset = (id) =>
  api.get(`/datasets/${id}`).then((r) => r.data);

export const renameDataset = (id, data) =>
  api.patch(`/datasets/${id}`, data).then((r) => r.data);

export const assignDataset = (id, assignedTo) =>
  api.patch(`/datasets/${id}/assign`, { assignedTo }).then((r) => r.data);

export const duplicateDataset = (id, name) =>
  api.post(`/datasets/${id}/duplicate`, { name }).then((r) => r.data);

export const deleteDataset = (id) =>
  api.delete(`/datasets/${id}`).then((r) => r.data);

export const getDatasetStats = () =>
  api.get("/datasets/stats").then((r) => r.data);

export const previewImport = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/datasets/preview", form).then((r) => r.data);
};

/**
 * Import a file.
 *
 * @param {File} file
 * @param {string} [name]                   - optional dataset name
 * @param {Function} [onProgress]           - upload progress callback (0..100)
 * @param {"skip"|"rename"} [dedupeStrategy]
 * @param {string|null} [taxonomyId]        - optional taxonomy to attach
 */
export const importDataset = async (
  file,
  name,
  onProgress,
  dedupeStrategy = "skip",
  taxonomyId = null,
) => {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  form.append("dedupeStrategy", dedupeStrategy);
  if (taxonomyId) form.append("taxonomyId", taxonomyId);

  const r = await api
    .post("/datasets/import", form, {
      onUploadProgress: (e_1) => {
        if (onProgress && e_1.total) {
          onProgress(Math.round((e_1.loaded * 100) / e_1.total));
        }
      },
    });
  return r.data;
};