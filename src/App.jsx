import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import UserManagement from "./Pages/UserManagement";
import Profile from "./Pages/Profile";
import ProjectManagement from "./Pages/ProjectManagement";
import ProjectDetail from "./Pages/ProjectDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import NotFound from "./Pages/NotFound";
import CommentHistoryListener from "./components/CommentHistoryListener"; // ← ADD

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          }
        />
      </Routes>
      <CommentHistoryListener /> 
    </>
  );
}

export default App;
