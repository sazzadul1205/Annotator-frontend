// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import BootstrapPage from "./pages/auth/BootstrapPage";
import ServiceUnavailablePage from "./pages/ServiceUnavailablePage";
import NotFoundPage from "./pages/NotFoundPage";

import DatasetsPage from "./pages/DatasetsPage";
import DatasetDetailPage from "./pages/DatasetDetailPage";
import UsersPage from "./pages/UsersPage";

import PublicLayout from "./layouts/PublicLayout";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />

      {/* Service Unavailable — reachable even when the backend is down */}
      <Route
        path="/service-unavailable"
        element={<ServiceUnavailablePage />}
      />

      {/* Protected */}
      <Route
        element={
          <ProtectedRoute>
            <PublicLayout />
          </ProtectedRoute>
        }
      >
        {/* Landing goes straight to datasets */}
        <Route path="/" element={<Navigate to="/datasets" replace />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/datasets/:id" element={<DatasetDetailPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}