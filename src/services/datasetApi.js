// src/services/datasetApi.js
import api from "./api";
import { tokenStore } from "./api";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${tokenStore.get()}` },
});

export const listDatasets = (params) =>
  api.get("/datasets", { ...authHeader(), params }).then((r) => r.data);

export const getDataset = (id) =>
  api.get(`/datasets/${id}`, authHeader()).then((r) => r.data);

export const renameDataset = (id, data) =>
  api.patch(`/datasets/${id}`, data, authHeader()).then((r) => r.data);

export const assignDataset = (id, assignedTo) =>
  api
    .patch(`/datasets/${id}/assign`, { assignedTo }, authHeader())
    .then((r) => r.data);

export const duplicateDataset = (id, name) =>
  api
    .post(`/datasets/${id}/duplicate`, { name }, authHeader())
    .then((r) => r.data);

export const deleteDataset = (id) =>
  api.delete(`/datasets/${id}`, authHeader()).then((r) => r.data);

// Import a File
export const importDataset = (file, name, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);

  return api
    .post("/datasets/import", form, {
      headers: {
        Authorization: `Bearer ${tokenStore.get()}`,
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    })
    .then((r) => r.data);
};
