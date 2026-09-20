// src/layouts/PublicLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  LogOut,
  Tag,
  ChevronRight,
  LayoutDashboard,
  History,
  Tags,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../context/useAuth";

const linkClass = ({ isActive }) =>
  `group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? "bg-primary text-primary-content shadow-sm shadow-primary/20"
      : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
  }`;

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-base-200">
      <header className="sticky top-0 z-30 border-b border-base-content/5 bg-base-100/80 backdrop-blur-xl">
        <div className="navbar min-h-16 px-4">
          <div className="flex-1 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Tag className="w-4.5 h-4.5 text-primary-content" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight">
                Annotator
              </span>
              <span className="text-[10px] uppercase tracking-widest text-base-content/40">
                Dashboard
              </span>
            </div>
          </div>

          <div className="flex-none flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pl-3 pr-1 border-l border-base-content/10">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-base-content/50">
                  {user?.role}
                </span>
              </div>
            </div>

            <button
              className="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-error hover:bg-error/10 normal-case font-normal"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-60 min-h-[calc(100vh-64px)] sticky top-16 self-start bg-base-100/60 backdrop-blur-sm border-r border-base-content/5 p-3">
          <p className="px-3 pt-2 pb-2 text-[10px] uppercase tracking-widest text-base-content/40 font-semibold">
            Menu
          </p>
          <nav className="space-y-1">
            <NavLink to="/dashboard" className={linkClass}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
            </NavLink>

            <NavLink to="/datasets" className={linkClass}>
              <LayoutGrid className="w-4 h-4" />
              Datasets
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
            </NavLink>

            {user?.role === "admin" && (
              <>
                <p className="px-3 pt-4 pb-2 text-[10px] uppercase tracking-widest text-base-content/40 font-semibold">
                  Admin
                </p>
                <NavLink to="/users" className={linkClass}>
                  <Users className="w-4 h-4" />
                  Users
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
                </NavLink>

                <NavLink to="/audit" className={linkClass}>
                  <History className="w-4 h-4" />
                  Audit Log
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
                </NavLink>
                <NavLink to="/taxonomies" className={linkClass}>
                  <Tags className="w-4 h-4" />
                  Taxonomies
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
                </NavLink>
                <NavLink to="/analytics" className={linkClass}>
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all" />
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
