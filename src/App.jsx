// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// auth Pages
import LoginPage from "./pages/auth/LoginPage";
import BootstrapPage from "./pages/auth/BootstrapPage";

// Pages
import DashboardPage from "./pages/DashboardPage";

import PublicLayout from "./layouts/PublicLayout";

// Placeholders — real pages come next
function DatasetsPage() {
  return <div>Datasets — coming next</div>;
}
function CommentsPage() {
  return <div>Comments — coming next</div>;
}
function AnnotatePage() {
  return <div>Annotate — coming next</div>;
}
function UsersPage() {
  return <div>Users — coming next</div>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />

      {/* Protected — everything inside Layout */}
      <Route
        element={
          <ProtectedRoute>
            <PublicLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/comments" element={<CommentsPage />} />
        <Route path="/annotate" element={<AnnotatePage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}