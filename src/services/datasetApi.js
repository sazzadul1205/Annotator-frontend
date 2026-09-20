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

// NEW
export const getDatasetStats = () =>
  api.get("/datasets/stats").then((r) => r.data);

// NEW — dry-run upload, returns { preview: {...} }
export const previewImport = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/datasets/preview", form).then((r) => r.data);
};

// Import a File
export const importDataset = (file, name, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);

  return api
    .post("/datasets/import", form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    })
    .then((r) => r.data);
};
