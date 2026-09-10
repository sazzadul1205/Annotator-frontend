import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

/* AUTH API */
export const loginUser = (username, password) =>
  axios.post(`${API_URL}/auth/login`, { username, password });

export const createAccount = (userData) =>
  axios.post(`${API_URL}/auth/create-account`, userData, {
    headers: authHeaders(),
  });

export const getUsers = () =>
  axios.get(`${API_URL}/auth/users`, { headers: authHeaders() });

export const updateAccount = (userId, data) =>
  axios.put(`${API_URL}/auth/update-account/${userId}`, data, {
    headers: authHeaders(),
  });

export const changePassword = (userId, data) =>
  axios.put(`${API_URL}/auth/change-password/${userId}`, data, {
    headers: authHeaders(),
  });

export const deleteAccount = (userId) =>
  axios.delete(`${API_URL}/auth/delete-account/${userId}`, {
    headers: authHeaders(),
  });

/* PROJECT API */
export const createProject = (projectData) =>
  axios.post(`${API_URL}/projects`, projectData, { headers: authHeaders() });

export const getProjects = () =>
  axios.get(`${API_URL}/projects`, { headers: authHeaders() });

export const getProject = (projectId) =>
  axios.get(`${API_URL}/projects/${projectId}`, { headers: authHeaders() });

/** NEW: update project metadata */
export const updateProject = (projectId, data) =>
  axios.put(`${API_URL}/projects/${projectId}`, data, { headers: authHeaders() });

export const deleteProject = (projectId) =>
  axios.delete(`${API_URL}/projects/${projectId}`, { headers: authHeaders() });

export const uploadFileToProject = (projectId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return axios.post(`${API_URL}/projects/${projectId}/upload`, formData, {
    headers: {
      ...authHeaders(),
      "Content-Type": "multipart/form-data",
    },
  });
};

/* EXPORT (with filters) */
export const downloadCommentsCSV = (projectId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const suffix = qs ? `?${qs}` : "";
  return axios.get(`${API_URL}/projects/${projectId}/download-csv${suffix}`, {
    headers: authHeaders(),
    responseType: "blob",
  });
};

export const downloadCommentsExcel = (projectId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const suffix = qs ? `?${qs}` : "";
  return axios.get(`${API_URL}/projects/${projectId}/download-excel${suffix}`, {
    headers: authHeaders(),
    responseType: "blob",
  });
};

/* COMMENT API */
export const getComments = (projectId, params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  return axios.get(
    `${API_URL}/projects/${projectId}/comments?${queryParams}`,
    { headers: authHeaders() }
  );
};

/** NEW: create a comment manually */
export const createComment = (projectId, data) =>
  axios.post(`${API_URL}/projects/${projectId}/comments`, data, {
    headers: authHeaders(),
  });

/** NEW: update comment text */
export const updateCommentText = (commentId, text) =>
  axios.put(
    `${API_URL}/comments/${commentId}/text`,
    { text },
    { headers: authHeaders() }
  );

/** NEW: delete a comment */
export const deleteComment = (commentId) =>
  axios.delete(`${API_URL}/comments/${commentId}`, { headers: authHeaders() });

/** Existing: validate single comment */
export const validateComment = (commentId, data) =>
  axios.put(`${API_URL}/comments/${commentId}`, data, { headers: authHeaders() });

/** NEW: bulk validate */
export const bulkValidateComments = (projectId, items) =>
  axios.post(
    `${API_URL}/projects/${projectId}/comments/bulk-validate`,
    { items },
    { headers: authHeaders() }
  );

export const getUnvalidatedCount = (projectId) =>
  axios.get(`${API_URL}/projects/${projectId}/unvalidated-count`, {
    headers: authHeaders(),
  });

/* VERSIONING API */
export const getVersionHistory = (entityType, entityId, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const suffix = qs ? `?${qs}` : "";
  return axios.get(
    `${API_URL}/versions/${entityType}/${entityId}${suffix}`,
    { headers: authHeaders() }
  );
};

export const getVersionSnapshot = (entityType, entityId, version) =>
  axios.get(`${API_URL}/versions/${entityType}/${entityId}/${version}`, {
    headers: authHeaders(),
  });

export const revertToVersion = (entityType, entityId, version) =>
  axios.post(
    `${API_URL}/versions/${entityType}/${entityId}/${version}/revert`,
    {},
    { headers: authHeaders() }
  );