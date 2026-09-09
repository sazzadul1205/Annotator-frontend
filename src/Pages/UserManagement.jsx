import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createAccount, deleteAccount, updateAccount } from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import Swal from "sweetalert2";
import {
  Plus,
  Edit,
  Trash2,
  X,
  UserPlus,
  Shield,
  User,
  Mail,
  Lock,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react";

function UserManagement() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "Annotator", // Fixed - always Annotator
  });
  const [error, setError] = useState("");

  // Fetch users
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (userData) => createAccount(userData),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      setShowModal(false);
      setNewUser({ username: "", email: "", password: "", role: "Annotator" });
      setError("");
      Swal.fire({
        icon: "success",
        title: "User Created!",
        text: "New annotator has been added successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      setError(err.response?.data?.error || "Failed to create user");
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: err.response?.data?.error || "Failed to create user",
        confirmButtonColor: "#3B82F6",
      });
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ userId, data }) => updateAccount(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      setShowEditModal(false);
      setEditingUser(null);
      setError("");
      Swal.fire({
        icon: "success",
        title: "User Updated!",
        text: "User information has been updated successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      setError(err.response?.data?.error || "Failed to update user");
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.response?.data?.error || "Failed to update user",
        confirmButtonColor: "#3B82F6",
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (userId) => deleteAccount(userId),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      Swal.fire({
        icon: "success",
        title: "User Deleted!",
        text: "User has been removed successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.response?.data?.error || "Failed to delete user",
        confirmButtonColor: "#3B82F6",
      });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError("All fields are required");
      return;
    }
    if (newUser.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    createMutation.mutate(newUser);
  };

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const updateData = {};
    if (editingUser.username) updateData.username = editingUser.username;
    if (editingUser.email) updateData.email = editingUser.email;
    if (editingUser.password) updateData.password = editingUser.password;
    if (editingUser.role) updateData.role = editingUser.role;
    
    updateMutation.mutate({
      userId: editingUser._id,
      data: updateData
    });
  };

  const handleDelete = (userId, username) => {
    if (userId === currentUser?._id) {
      Swal.fire({
        icon: "warning",
        title: "Cannot Delete",
        text: "You cannot delete your own account!",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }
    
    Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${username}". This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, delete user",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(userId);
      }
    });
  };

  const handleEdit = (user) => {
    setEditingUser({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      password: "",
    });
    setShowEditModal(true);
    setError("");
  };

  const users = data?.data?.data || [];

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Users size={32} className="text-blue-500" />
              User Management
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage annotators and administrators
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            <Plus size={20} />
            Create Annotator
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            Failed to load users.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {users.length === 0 ? (
              <div className="p-12 text-center">
                <Users size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600">No Users</h3>
                <p className="text-gray-500 mt-2">Create your first user to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User size={16} className="text-blue-600" />
                            </div>
                            <div>
                              <span className="font-medium">{user.username}</span>
                              {user._id === currentUser?._id && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle size={12} />
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${
                              user.role === "Admin"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {user.role === "Admin" ? (
                              <Shield size={12} />
                            ) : (
                              <User size={12} />
                            )}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                          {new Date(user.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-800 transition p-1.5 hover:bg-blue-50 rounded-lg"
                              title="Edit user"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(user._id, user.username)}
                              disabled={
                                deleteMutation.isPending || 
                                user._id === currentUser?._id
                              }
                              className={`p-1.5 rounded-lg transition ${
                                user._id === currentUser?._id
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-800 hover:bg-red-50"
                              }`}
                              title={
                                user._id === currentUser?._id
                                  ? "Cannot delete your own account"
                                  : "Delete user"
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {users.length > 0 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                Total users: {users.length}
              </div>
            )}
          </div>
        )}

        {/* Create Modal - ONLY ANNOTATOR */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <UserPlus size={22} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Create Annotator</h2>
                    <p className="text-sm text-gray-500">Add a new user to the system</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                    setNewUser({ username: "", email: "", password: "", role: "Annotator" });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-6">
                {error && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <form onSubmit={handleCreateSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        Username <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) =>
                        setNewUser({ ...newUser, username: e.target.value })
                      }
                      placeholder="Enter username"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        Email <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) =>
                        setNewUser({ ...newUser, email: e.target.value })
                      }
                      placeholder="Enter email address"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Lock size={16} className="text-gray-400" />
                        Password <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      placeholder="Enter password (min 6 characters)"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                      minLength={6}
                    />
                    <p className="mt-1 text-xs text-gray-400">Minimum 6 characters</p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Shield size={16} className="text-gray-400" />
                        Role
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value="Annotator"
                        disabled
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle size={16} className="text-blue-500" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                      <User size={12} />
                      All new users are created as Annotators
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setError("");
                        setNewUser({ username: "", email: "", password: "", role: "Annotator" });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
                    >
                      <UserPlus size={18} />
                      {createMutation.isPending ? "Creating..." : "Create Annotator"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Edit size={22} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Edit User</h2>
                    <p className="text-sm text-gray-500">Update user information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setError("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-6">
                {error && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        Username <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editingUser.username}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, username: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        Email <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Lock size={16} className="text-gray-400" />
                        New Password <span className="text-gray-400 text-xs">(optional)</span>
                      </span>
                    </label>
                    <input
                      type="password"
                      value={editingUser.password || ""}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, password: e.target.value })
                      }
                      placeholder="Leave blank to keep current"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      minLength={6}
                    />
                    <p className="mt-1 text-xs text-gray-400">Minimum 6 characters if changing</p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-2">
                        <Shield size={16} className="text-gray-400" />
                        Role
                      </span>
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                    >
                      <option value="Annotator">Annotator</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingUser(null);
                        setError("");
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
                    >
                      <CheckCircle size={18} />
                      {updateMutation.isPending ? "Updating..." : "Update User"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;