import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  alertSuccess,
  alertError,
  confirmAction,
  confirmDelete,
  promptPasswordReset,
} from "../lib/swal";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}