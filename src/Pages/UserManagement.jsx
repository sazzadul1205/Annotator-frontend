import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createAccount, deleteAccount, updateAccount } from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
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
    role: "Annotator",
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
    },
    onError: (err) => {
      setError(err.response?.data?.error || "Failed to create user");
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
    },
    onError: (err) => {
      setError(err.response?.data?.error || "Failed to update user");
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (userId) => deleteAccount(userId),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
    },
    onError: (err) => {
      alert(
        "Failed to delete user: " +
          (err.response?.data?.error || "Unknown error"),
      );
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.email || !newUser.password) {
      setError("All fields are required");
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

  const handleDelete = (userId) => {
    if (userId === currentUser?._id) {
      alert("You cannot delete your own account!");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteMutation.mutate(userId);
    }
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
          <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
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
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
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
                        <User size={16} className="text-gray-400" />
                        <span className="font-medium">{user.username}</span>
                        {user._id === currentUser?._id && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle size={12} />
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${
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
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-800 transition p-1 hover:bg-blue-50 rounded"
                          title="Edit user"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user._id)}
                          disabled={
                            deleteMutation.isPending || 
                            user._id === currentUser?._id
                          }
                          className={`p-1 rounded transition ${
                            user._id === currentUser?._id
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:text-red-800 hover:bg-red-50"
                          }`}
                          title={
                            user._id === currentUser?._id
                              ? "Cannot delete your own account"
                              : "Delete user"
                          }
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal - ONLY ANNOTATOR */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <UserPlus size={24} className="text-blue-500" />
                  Create New Annotator
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition p-1 hover:bg-gray-100 rounded"
                >
                  <X size={24} />
                </button>
              </div>
              {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <form onSubmit={handleCreateSubmit}>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-2">
                    <User size={16} />
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser({ ...newUser, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Mail size={16} />
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Lock size={16} />
                    Password
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Shield size={16} />
                    Role
                  </label>
                  <input
                    type="text"
                    value="Annotator"
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    All new users are created as Annotators
                  </p>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300 flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    {createMutation.isPending ? "Creating..." : "Create Annotator"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Edit size={24} className="text-blue-500" />
                  Edit User
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setError("");
                  }}
                  className="text-gray-500 hover:text-gray-700 transition p-1 hover:bg-gray-100 rounded"
                >
                  <X size={24} />
                </button>
              </div>
              {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <form onSubmit={handleUpdateSubmit}>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-2">
                    <User size={16} />
                    Username
                  </label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Mail size={16} />
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Lock size={16} />
                    New Password (optional)
                  </label>
                  <input
                    type="password"
                    value={editingUser.password || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1 items-center gap-">
                    <Shield size={16} />
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Annotator">Annotator</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                      setError("");
                    }}
                    className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300 flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    {updateMutation.isPending ? "Updating..." : "Update User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;