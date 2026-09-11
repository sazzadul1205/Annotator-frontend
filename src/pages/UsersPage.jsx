
// React
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Icons
import {
  X,
  Power,
  Trash2,
  UserPlus,
  KeyRound,
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


function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  // Modal and selected user state
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  // Fetch all users
  const { data, isLoading, error: listError } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const users = data?.users || [];

  // Refresh the users list
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });

  // Toggle user active/inactive status
  const toggleMutation = useMutation({
    mutationFn: (id) => toggleUserStatus(id),
    onSuccess: (res) => {
      alertSuccess("Done", res.message);
      invalidate();
    },
    onError: (err) => {
      alertError("Update failed", err?.response?.data?.error || err.message);
    },
  });

  // Delete a user
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      alertSuccess("Done", "User deleted.");
      invalidate();
    },
    onError: (err) => {
      alertError("Delete failed", err?.response?.data?.error || err.message);
    },
  });

  // Confirm and toggle a user's status
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

    if (ok) toggleMutation.mutate(u._id);
  };

  // Confirm and delete a user
  const handleDelete = async (u) => {
    // Prevent the current user from deleting themselves
    if (u._id === me?._id) return;

    const ok = await confirmDelete(
      `Delete ${u.name}?`,
      "This action cannot be undone.",
    );

    if (ok) deleteMutation.mutate(u._id);
  };
  
  return (
    <div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <button
          className="btn btn-primary btn-sm gap-1"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          {isLoading && (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner" />
            </div>
          )}

          {listError && (
            <div className="alert alert-error text-sm">
              <span>{listError.message}</span>
            </div>
          )}

          {!isLoading && users.length === 0 && (
            <p className="text-center text-base-content/60 py-6">
              No users yet.
            </p>
          )}

          {users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-zebra table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u._id === me?._id;
                    return (
                      <tr key={u._id}>
                        <td className="font-medium">
                          {u.name}
                          {isMe && (
                            <span className="badge badge-ghost badge-xs ml-2">
                              you
                            </span>
                          )}
                        </td>
                        <td className="text-sm">{u.email}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${u.role === "admin"
                              ? "badge-primary"
                              : "badge-secondary"
                              }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm ${u.isActive ? "badge-success" : "badge-error"
                              }`}
                          >
                            {u.isActive ? "active" : "inactive"}
                          </span>
                        </td>
                        <td className="text-xs text-base-content/60">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            className="btn btn-xs btn-ghost gap-1"
                            onClick={() => setResetTarget(u)}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Reset Pwd
                          </button>
                          <button
                            className="btn btn-xs btn-ghost gap-1"
                            onClick={() => handleToggle(u)}
                            disabled={isMe}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="btn btn-xs btn-ghost text-error gap-1"
                            onClick={() => handleDelete(u)}
                            disabled={isMe}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
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

// Create User Modal
function CreateUserModal({ onClose, onCreated, onError }) {
  const [loading, setLoading] = useState(false);

  // Form hooks
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

  // On submit
  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await createUser(values);
      onCreated();
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">

      {/* Modal */}
      <div className="modal-box">

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Create User
          </h3>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              autoFocus
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.name.message}
                </span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^\S+@\S+\.\S+$/,
                  message: "Invalid email",
                },
              })}
            />
            {errors.email && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.email.message}
                </span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="At least 8 characters"
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Must be at least 8 characters",
                },
              })}
            />
            {errors.password && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.password.message}
                </span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Role</span>
            </label>
            <select
              className="select select-bordered w-full"
              {...register("role", { required: true })}
            >
              <option value="annotator">Annotator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal backdrop */}
      <div
        className="modal-backdrop"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}

// Reset Password Modal
function ResetPasswordModal({ user, onClose, onDone, onError }) {
  const [loading, setLoading] = useState(false);

  // Form hooks
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

  // Watch new password
  const newPassword = useWatch({ control, name: "newPassword" });

  // On submit
  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await resetUserPassword(user._id, values);
      onDone("Password reset successfully.");
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      {/* Modal */}
      <div className="modal-box">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Reset Password
          </h3>
          <button
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User */}
        <p className="text-sm text-base-content/70 mb-4">
          For <strong>{user.name}</strong> ({user.email})
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text">New Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
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
            {errors.newPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.newPassword.message}
                </span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Confirm Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Repeat password"
              autoComplete="new-password"
              {...register("confirmPassword", {
                required: "Please confirm the password",
                validate: (v) =>
                  v === newPassword || "Passwords do not match",
              })}
            />
            {errors.confirmPassword && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.confirmPassword.message}
                </span>
              </label>
            )}
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary gap-2"
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
      </div>

      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
    </div>
  );
}