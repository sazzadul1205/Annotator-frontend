// src/services/api.js
import axios from "axios";

const TOKEN_KEY = "annotator_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

// Attach the bearer token to every request automatically
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler — clear token and notify the app
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Do not redirect for the login endpoint itself
      const url = error?.config?.url || "";
      const isAuthEndpoint =
        url.includes("/auth/login") ||
        url.includes("/auth/bootstrap") ||
        url.includes("/auth/bootstrap-status");

      if (!isAuthEndpoint) {
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent("auth-expired"));
      }
    }

    return Promise.reject(error);
  },
);

export default api;
