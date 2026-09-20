// src/services/userApi.js
import api from "./api";

export const listUsers = () => api.get("/users").then((r) => r.data);

export const getUser = (id) => api.get(`/users/${id}`).then((r) => r.data);

export const createUser = (data) =>
  api.post("/users", data).then((r) => r.data);

export const updateUser = (id, data) =>
  api.patch(`/users/${id}`, data).then((r) => r.data);

export const toggleUserStatus = (id) =>
  api.patch(`/users/${id}/status`, null).then((r) => r.data);

export const resetUserPassword = (id, data) =>
  api.post(`/users/${id}/reset-password`, data).then((r) => r.data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`).then((r) => r.data);
