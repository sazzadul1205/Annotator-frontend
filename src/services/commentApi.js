// src/services/commentApi.js
import api from "./api";
import { tokenStore } from "./api";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${tokenStore.get()}` },
});

export const listComments = (params) =>
  api
    .get("/comments", { ...authHeader(), params })
    .then((r) => r.data);

export const getComment = (id) =>
  api.get(`/comments/${id}`, authHeader()).then((r) => r.data);

export const createComment = (data) =>
  api.post("/comments", data, authHeader()).then((r) => r.data);

export const updateComment = (id, data) =>
  api.patch(`/comments/${id}`, data, authHeader()).then((r) => r.data);

export const deleteComment = (id) =>
  api.delete(`/comments/${id}`, authHeader()).then((r) => r.data);

export const annotateComment = (id, data) =>
  api
    .patch(`/comments/${id}/annotation`, data, authHeader())
    .then((r) => r.data);

export const getCommentVersions = (id) =>
  api.get(`/comments/${id}/versions`, authHeader()).then((r) => r.data);

export const restoreCommentVersion = (id, version) =>
  api
    .post(`/comments/${id}/restore/${version}`, null, authHeader())
    .then((r) => r.data);

// Export file download
export const exportComments = (params) =>
  api
    .get("/comments/export", {
      ...authHeader(),
      params,
      responseType: "blob",
    })
    .then((r) => r.data);