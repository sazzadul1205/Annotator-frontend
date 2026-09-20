// src/services/auditApi.js
import api from "./api";

export const listAuditEntries = (params) =>
  api.get("/audit", { params }).then((r) => r.data);

export const listAuditActions = () =>
  api.get("/audit/actions").then((r) => r.data);