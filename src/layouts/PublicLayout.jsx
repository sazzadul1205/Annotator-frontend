// src/Layouts/PublicLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, Users, LogOut, Tag } from "lucide-react";
import { useAuth } from "../context/useAuth";

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive
    ? "bg-primary text-primary-content"
    : "hover:bg-base-200 text-base-content"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-2">
          <Tag className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold">Annotator</span>
        </div>
        <div className="flex-none flex items-center gap-2 px-2">
          <span className="text-sm hidden sm:inline">
            {user?.name}{" "}
            <span className="badge badge-ghost badge-sm ml-1">{user?.role}</span>
          </span>
          <button
            className="btn btn-sm btn-outline gap-1"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Sidebar + content */}
      <div className="flex">
        <aside className="w-56 min-h-[calc(100vh-64px)] bg-base-100 border-r border-base-300 p-3 space-y-1">
          <NavLink to="/datasets" className={linkClass}>
            <LayoutGrid className="w-4 h-4" />
            Datasets
          </NavLink>

          {/* Admin-only links */}
          {user?.role === "admin" && (
            <NavLink to="/users" className={linkClass}>
              <Users className="w-4 h-4" />
              Users
            </NavLink>
          )}
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}