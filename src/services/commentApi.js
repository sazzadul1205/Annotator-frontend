// src/services/commentApi.js
import api from "./api";

export const listComments = (params) =>
  api.get("/comments", { params }).then((r) => r.data);

export const getComment = (id) =>
  api.get(`/comments/${id}`).then((r) => r.data);

export const createComment = (data) =>
  api.post("/comments", data).then((r) => r.data);

export const updateComment = (id, data) =>
  api.patch(`/comments/${id}`, data).then((r) => r.data);

export const deleteComment = (id) =>
  api.delete(`/comments/${id}`).then((r) => r.data);

export const annotateComment = (id, data) =>
  api.patch(`/comments/${id}/annotation`, data).then((r) => r.data);

export const getCommentVersions = (id, params = {}) =>
  api.get(`/comments/${id}/versions`, { params }).then((r) => r.data);

export const restoreCommentVersion = (id, version) =>
  api.post(`/comments/${id}/restore/${version}`).then((r) => r.data);

export const exportComments = (params) =>
  api
    .get("/comments/export", { params, responseType: "blob" })
    .then((r) => r.data);

// NEW
export const bulkAnnotateComments = (data) =>
  api.post("/comments/bulk-annotate", data).then((r) => r.data);

export const bulkAssignComments = (data) =>
  api.post("/comments/bulk-assign", data).then((r) => r.data);