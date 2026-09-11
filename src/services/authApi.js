import api from "./api";
import { tokenStore } from "./api";

export const getBootstrapStatus = () =>
  api.get("/auth/bootstrap-status").then((r) => r.data);

export const bootstrapAdmin = (data) =>
  api.post("/auth/bootstrap", data).then((r) => r.data);

export const login = (data) =>
  api.post("/auth/login", data).then((r) => r.data);

export const logout = () => api.post("/auth/logout").then((r) => r.data);

export const getMe = () =>
  api
    .get("/auth/me", {
      headers: { Authorization: `Bearer ${tokenStore.get()}` },
    })
    .then((r) => r.data);
