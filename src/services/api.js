import axios from "axios";

const API_URL = "http://localhost:5000/api";

// ============== AUTH API ==============
export const loginUser = (username, password) => {
  return axios.post(`${API_URL}/auth/login`, { username, password });
};

export const createAccount = (userData) => {
  return axios.post(`${API_URL}/auth/create-account`, userData);
};

export const getUsers = () => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/auth/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const updateAccount = (userId, data) => {
  const token = localStorage.getItem("token");
  return axios.put(`${API_URL}/auth/update-account/${userId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const changePassword = (userId, data) => {
  const token = localStorage.getItem("token");
  return axios.put(`${API_URL}/auth/change-password/${userId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const deleteAccount = (userId) => {
  const token = localStorage.getItem("token");
  return axios.delete(`${API_URL}/auth/delete-account/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ============== PROJECT API ==============
export const createProject = (projectData) => {
  const token = localStorage.getItem("token");
  return axios.post(`${API_URL}/projects`, projectData, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getProjects = () => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getProject = (projectId) => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const deleteProject = (projectId) => {
  const token = localStorage.getItem("token");
  return axios.delete(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const uploadFileToProject = (projectId, file) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  return axios.post(`${API_URL}/projects/${projectId}/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

// 📥 Download CSV – returns the file as a blob
export const downloadCommentsCSV = (projectId) => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/projects/${projectId}/download-csv`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "blob", // Important: to handle binary data
  });
};

// ============== COMMENT API ==============
export const getComments = (projectId, params = {}) => {
  const token = localStorage.getItem("token");
  const queryParams = new URLSearchParams(params).toString();
  return axios.get(`${API_URL}/projects/${projectId}/comments?${queryParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const validateComment = (commentId, data) => {
  const token = localStorage.getItem("token");
  return axios.put(`${API_URL}/comments/${commentId}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getUnvalidatedCount = (projectId) => {
  const token = localStorage.getItem("token");
  return axios.get(`${API_URL}/projects/${projectId}/unvalidated-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};