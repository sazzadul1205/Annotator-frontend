// src/pages/UsersPage.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Power,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  listUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
} from "../services/userApi";
import { useAuth } from "../context/useAuth";

export default function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // ---- Load users ----
  const { data, isLoading, error: listError } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const users = data?.users || [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["users"] });

  // ---- Toggle status ----
  const toggleMutation = useMutation({
    mutationFn: (id) => toggleUserStatus(id),
    onSuccess: (res) => {
      setSuccess(res.message);
      setError("");
      invalidate();
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message);
    },
  });

  // ---- Reset password ----
  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword, confirmPassword }) =>
      resetUserPassword(id, { newPassword, confirmPassword }),
    onSuccess: () => {
      setSuccess("Password reset successfully.");
      setError("");
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message);
    },
  });

  // ---- Delete ----
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      setSuccess("User deleted.");
      setError("");
      invalidate();
      setTimeout(() => setSuccess(""), 2500);
    },
    onError: (err) => {
      setError(err?.response?.data?.error || err.message);
    },
  });

  // ---- Handlers ----
  const handleToggle = (u) => {
    const msg = u.isActive
      ? `Deactivate ${u.name}? They won't be able to log in.`
      : `Activate ${u.name}?`;
    if (window.confirm(msg)) toggleMutation.mutate(u._id);
  };

  const handleReset = (u) => {
    const newPassword = window.prompt(`New password for ${u.name} (min 8 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const confirmPassword = window.prompt("Confirm password:");
    if (confirmPassword !== newPassword) {
      setError("Passwords do not match.");
      return;
    }
    resetMutation.mutate({ id: u._id, newPassword, confirmPassword });
  };

  const handleDelete = (u) => {
    if (u._id === me?._id) return;
    if (window.confirm(`Permanently delete ${u.name}? This cannot be undone.`)) {
      deleteMutation.mutate(u._id);
    }
  };

  return (
    <div>
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

      {error && (
        <div className="alert alert-error text-sm py-2 mb-3">
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success text-sm py-2 mb-3">
          <span>{success}</span>
        </div>
      )}

      {/* Users table */}
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
                            onClick={() => handleReset(u)}
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

      {/* Create user modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setSuccess("User created.");
            invalidate();
            setTimeout(() => setSuccess(""), 2500);
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

// ---------- Create User Modal ----------

function CreateUserModal({ onClose, onCreated, onError }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("annotator");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser({ name, email, password, role });
      onCreated();
    } catch (err) {
      onError(err?.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create User</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Role</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={role}
              onChange={(e) => setRole(e.target.value)}
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
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}