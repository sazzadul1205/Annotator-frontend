// src/services/taxonomyApi.js
import api from "./api";

/** List taxonomies (admin sees all; annotators see only active). */
export const listTaxonomies = (params) =>
  api.get("/taxonomies", { params }).then((r) => r.data);

/** Built-in fallback values used when a dataset has no taxonomy. */
export const getDefaultTaxonomy = () =>
  api.get("/taxonomies/defaults").then((r) => r.data);

/** Effective taxonomy for a dataset (resolves defaults if unassigned). */
export const getTaxonomyForDataset = (datasetId) =>
  api.get(`/taxonomies/for-dataset/${datasetId}`).then((r) => r.data);

/** Get one taxonomy. */
export const getTaxonomy = (id) =>
  api.get(`/taxonomies/${id}`).then((r) => r.data);

/** Create a taxonomy. */
export const createTaxonomy = (data) =>
  api.post("/taxonomies", data).then((r) => r.data);

/** Update a taxonomy (name, description, isActive, sentiment[], type[]). */
export const updateTaxonomy = (id, data) =>
  api.patch(`/taxonomies/${id}`, data).then((r) => r.data);

/** Soft-delete (default) or hard-delete (?hard=true). */
export const deleteTaxonomy = (id, hard = false) =>
  api
    .delete(`/taxonomies/${id}`, { params: hard ? { hard: "true" } : {} })
    .then((r) => r.data);

/** Assign a taxonomy to a dataset. */
export const assignTaxonomyToDataset = (taxonomyId, datasetId) =>
  api
    .patch(`/taxonomies/${taxonomyId}/assign/${datasetId}`)
    .then((r) => r.data);

/** Unassign a taxonomy from a dataset (falls back to defaults). */
export const unassignTaxonomyFromDataset = (taxonomyId, datasetId) =>
  api
    .delete(`/taxonomies/${taxonomyId}/assign/${datasetId}`)
    .then((r) => r.data);
