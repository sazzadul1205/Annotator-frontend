// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Placeholder pages — we'll replace these next steps
function LoginPage() {
  return <div className="p-6">Login page — coming next</div>;
}
function BootstrapPage() {
  return <div className="p-6">Bootstrap page — coming next</div>;
}
function HomePage() {
  return <div className="p-6">Home — coming next</div>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/bootstrap" element={<BootstrapPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}