// src/services/userApi.js
import api from "./api";
import { tokenStore } from "./api";

const authHeader = () => ({
  headers: { Authorization: `Bearer ${tokenStore.get()}` },
});

export const listUsers = () =>
  api.get("/users", authHeader()).then((r) => r.data);

export const getUser = (id) =>
  api.get(`/users/${id}`, authHeader()).then((r) => r.data);

export const createUser = (data) =>
  api.post("/users", data, authHeader()).then((r) => r.data);

export const updateUser = (id, data) =>
  api.patch(`/users/${id}`, data, authHeader()).then((r) => r.data);

export const toggleUserStatus = (id) =>
  api.patch(`/users/${id}/status`, null, authHeader()).then((r) => r.data);

export const resetUserPassword = (id, data) =>
  api.post(`/users/${id}/reset-password`, data, authHeader()).then((r) => r.data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`, authHeader()).then((r) => r.data);