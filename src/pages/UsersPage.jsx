// React
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Icons
import {
  X,
  Power,
  Trash2,
  UserPlus,
  KeyRound,
  User,
  Mail,
  Lock,
  ShieldCheck,
  Search,
  Users as UsersIcon,
} from "lucide-react";

// Services
import {
  listUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
} from "../services/userApi";

// Context
import { useAuth } from "../context/useAuth";

// Lib
import {
  alertSuccess,
  alertError,
  confirmAction,
  confirmDelete,
} from "../lib/swal";

/* Helpers                                                             */
const getInitials = (name) =>
  name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const roleBadgeClass = (role) =>
  role === "admin" ? "badge-primary" : "badge-secondary badge-outline";

function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  // Per-row busy tracking (so we can disable only the row being acted on)
  const [busyId, setBusyId] = useState(null);

  // Fetch all users
  const {
    data,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const users = data?.users || [];

  // Filtered users (search by name or email)
  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  });

  // Refresh the users list
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });

  // Toggle user active/inactive status
  const handleToggle = async (u) => {
    const title = u.isActive ? `Deactivate ${u.name}?` : `Activate ${u.name}?`;
    const text = u.isActive
      ? "They will no longer be able to log in."
      : "They will be able to log in again.";

    const ok = await confirmAction(
      title,
      text,
      u.isActive ? "Deactivate" : "Activate",
    );
    if (!ok) return;

    setBusyId(u._id);
    try {
      const res = await toggleUserStatus(u._id);
      alertSuccess("Done", res?.message || "Status updated.");
      invalidate();
    } catch (err) {
      alertError("Update failed", err?.response?.data?.error || err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Delete a user
  const handleDelete = async (u) => {
    if (u._id === me?._id) return;

    const ok = await confirmDelete(
      `Delete ${u.name}?`,
      "This action cannot be undone.",
    );
    if (!ok) return;

    setBusyId(u._id);
    try {
      await deleteUser(u._id);
      alertSuccess("Done", "User deleted.");
      invalidate();
    } catch (err) {
      alertError("Delete failed", err?.response?.data?.error || err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UsersIcon className="w-4.5 h-4.5" />
            </div>
            Users
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage accounts, roles and access for the workspace.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Table card */}
      <div className="card bg-base-100/80 backdrop-blur-xl shadow-xl border border-base-content/5">
        <div className="card-body p-0">
          {/* Card header with search + count */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-base-content/5">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">All users</h2>
              <span className="badge badge-ghost badge-sm">{users.length}</span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or email…"
                className="input input-sm input-bordered w-full pl-9 focus:input-primary transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            {isLoading && <UsersTableSkeleton rows={5} />}

            {listError && (
              <div className="alert alert-error text-sm rounded-lg">
                <span>{listError.message}</span>
              </div>
            )}

            {!isLoading && users.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-14">
                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-3">
                  <UsersIcon className="w-6 h-6 text-base-content/40" />
                </div>
                <p className="font-medium">No users yet</p>
                <p className="text-sm text-base-content/60 mt-1">
                  Create your first user to get started.
                </p>
              </div>
            )}

            {!isLoading && users.length > 0 && filteredUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-14">
                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-3">
                  <Search className="w-6 h-6 text-base-content/40" />
                </div>
                <p className="font-medium">No matches</p>
                <p className="text-sm text-base-content/60 mt-1">
                  No users match "{search}".
                </p>
              </div>
            )}

            {!isLoading && filteredUsers.length > 0 && (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="table table-sm">
                  <thead>
                    <tr className="border-base-content/5">
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        User
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Role
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Status
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                        Created
                      </th>
                      <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isMe = u._id === me?._id;
                      const isBusy = busyId === u._id;

                      return (
                        <tr
                          key={u._id}
                          className={`border-base-content/5 hover:bg-base-200/40 transition-colors ${
                            isBusy ? "opacity-60" : ""
                          }`}
                        >
                          {/* User cell */}
                          <td>
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                                  u.isActive
                                    ? "bg-primary/10 text-primary"
                                    : "bg-base-200 text-base-content/40"
                                }`}
                              >
                                {getInitials(u.name)}
                              </div>
                              <div className="flex flex-col leading-tight min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium truncate">
                                    {u.name}
                                  </span>
                                  {isMe && (
                                    <span className="badge badge-ghost badge-xs">
                                      you
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-base-content/50 truncate">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td>
                            <span
                              className={`badge badge-sm capitalize ${roleBadgeClass(
                                u.role,
                              )}`}
                            >
                              {u.role === "admin" && (
                                <ShieldCheck className="w-3 h-3 mr-1" />
                              )}
                              {u.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                u.isActive
                                  ? "text-success"
                                  : "text-base-content/40"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.isActive
                                    ? "bg-success shadow-[0_0_0_3px] shadow-success/20"
                                    : "bg-base-content/30"
                                }`}
                              />
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* Created */}
                          <td className="text-xs text-base-content/60 whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </td>

                          {/* Actions */}
                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                className="btn btn-xs btn-ghost gap-1 text-base-content/70 hover:text-base-content normal-case font-normal"
                                onClick={() => setResetTarget(u)}
                                disabled={isBusy}
                                title="Reset password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Reset</span>
                              </button>

                              <button
                                className={`btn btn-xs btn-ghost gap-1 text-base-content/70 hover:text-base-content normal-case font-normal ${
                                  isMe || isBusy
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                                onClick={() => handleToggle(u)}
                                title={u.isActive ? "Deactivate" : "Activate"}
                              >
                                {isBusy ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden md:inline">
                                  {u.isActive ? "Deactivate" : "Activate"}
                                </span>
                              </button>

                              <button
                                className={`btn btn-xs btn-ghost text-base-content/70 hover:text-error hover:bg-error/10 gap-1 normal-case font-normal ${
                                  isMe || isBusy
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                                onClick={() => handleDelete(u)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create User */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            alertSuccess("Done", "User created.");
            invalidate();
          }}
          onError={(msg) => alertError("Create failed", msg)}
        />
      )}

      {/* Reset Password */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={(msg) => {
            setResetTarget(null);
            alertSuccess("Done", msg);
          }}
          onError={(msg) => alertError("Reset failed", msg)}
        />
      )}
    </div>
  );
}

export default UsersPage;

// Skelton Loader
function UsersTableSkeleton({ rows = 5 }) {
  const skeletonRows = Array.from({ length: rows });

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="table table-sm">
        <thead>
          <tr className="border-base-content/5">
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              User
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Role
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Status
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
              Created
            </th>
            <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {skeletonRows.map((_, i) => (
            <tr key={i} className="border-base-content/5">
              <td>
                <div className="flex items-center gap-3">
                  <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <div className="skeleton h-3 w-28" />
                    <div className="skeleton h-2.5 w-40" />
                  </div>
                </div>
              </td>
              <td>
                <div className="skeleton h-5 w-20 rounded-full" />
              </td>
              <td>
                <div className="skeleton h-3 w-16" />
              </td>
              <td>
                <div className="skeleton h-3 w-24" />
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <div className="skeleton h-6 w-16 rounded-md" />
                  <div className="skeleton h-6 w-20 rounded-md" />
                  <div className="skeleton h-6 w-16 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Model Shell
function ModalShell({ children, onClose, disabled }) {
  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100/95 backdrop-blur-xl border border-base-content/5 shadow-2xl p-0">
        {children}
      </div>
      <div
        className="modal-backdrop bg-base-content/30 backdrop-blur-sm"
        onClick={disabled ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}

// User Model
function CreateUserModal({ onClose, onCreated, onError }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "annotator",
    },
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await createUser(values);
      onCreated();
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} disabled={loading}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-base-content/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Create User</h3>
            <p className="text-xs text-base-content/50">
              Add a new account to the workspace
            </p>
          </div>
        </div>
        <button
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onClose}
          disabled={loading}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                Name
              </span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="text"
                className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                  errors.name ? "input-error" : ""
                }`}
                placeholder="Jane Doe"
                autoFocus
                {...register("name", { required: "Name is required" })}
              />
            </div>
            {errors.name && (
              <p className="text-error text-xs mt-1.5">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                Email
              </span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="email"
                className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                  errors.email ? "input-error" : ""
                }`}
                placeholder="jane@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: "Invalid email",
                  },
                })}
              />
            </div>
            {errors.email && (
              <p className="text-error text-xs mt-1.5">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                Password
              </span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="password"
                className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                  errors.password ? "input-error" : ""
                }`}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Must be at least 8 characters",
                  },
                })}
              />
            </div>
            {errors.password && (
              <p className="text-error text-xs mt-1.5">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                Role
              </span>
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none z-10" />
              <select
                className="select select-bordered w-full pl-10 focus:select-primary transition-all"
                {...register("role", { required: true })}
              >
                <option value="annotator">Annotator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-base-content/5 bg-base-200/40">
          <button
            type="button"
            className="btn btn-ghost btn-sm normal-case font-normal"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm gap-2 shadow-md shadow-primary/20 normal-case"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create User
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Password Reset Modal
function ResetPasswordModal({ user, onClose, onDone, onError }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = useWatch({ control, name: "newPassword" });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await resetUserPassword(user._id, values);
      onDone("Password reset successfully.");
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} disabled={loading}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-base-content/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">Reset Password</h3>
            <p className="text-xs text-base-content/50">
              Set a new password for this account
            </p>
          </div>
        </div>
        <button
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onClose}
          disabled={loading}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-5 space-y-4">
          {/* User info chip */}
          <div className="flex items-center gap-3 rounded-lg bg-base-200/50 border border-base-content/5 p-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-medium truncate">{user.name}</span>
              <span className="text-xs text-base-content/50 truncate">
                {user.email}
              </span>
            </div>
          </div>

          {/* New password */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                New Password
              </span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="password"
                className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                  errors.newPassword ? "input-error" : ""
                }`}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
                {...register("newPassword", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Must be at least 8 characters",
                  },
                })}
              />
            </div>
            {errors.newPassword && (
              <p className="text-error text-xs mt-1.5">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="form-control">
            <label className="label pb-1.5">
              <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                Confirm Password
              </span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="password"
                className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                  errors.confirmPassword ? "input-error" : ""
                }`}
                placeholder="Repeat password"
                autoComplete="new-password"
                {...register("confirmPassword", {
                  required: "Please confirm the password",
                  validate: (v) =>
                    v === newPassword || "Passwords do not match",
                })}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-error text-xs mt-1.5">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-base-content/5 bg-base-200/40">
          <button
            type="button"
            className="btn btn-ghost btn-sm normal-case font-normal"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm gap-2 shadow-md shadow-primary/20 normal-case"
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Reset Password
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
