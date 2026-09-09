import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createAccount, deleteAccount, updateAccount } from "../services/api";
import Sidebar from "../components/Sidebar";
import UserModal from "../components/UserModal";
import { useAuth } from "../hooks/useAuth";
import Swal from "sweetalert2";
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  User,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react";

function UserManagement() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const createMutation = useMutation({
    mutationFn: (userData) => createAccount(userData),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      setShowModal(false);
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

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }) => updateAccount(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      setShowModal(false);
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

  const handleCreateSubmit = (userData) => {
    if (!userData.username || !userData.email || !userData.password) {
      setError("All fields are required");
      return;
    }
    if (userData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    createMutation.mutate(userData);
  };

  const handleUpdateSubmit = (userData) => {
    const updateData = {};
    if (userData.username) updateData.username = userData.username;
    if (userData.email) updateData.email = userData.email;
    if (userData.password) updateData.password = userData.password;
    if (userData.role) updateData.role = userData.role;
    
    updateMutation.mutate({
      userId: userData._id,
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
    setEditingUser(user);
    setModalMode('edit');
    setShowModal(true);
    setError("");
  };

  const handleCreate = () => {
    setModalMode('create');
    setEditingUser(null);
    setShowModal(true);
    setError("");
  };

  const users = data?.data?.data || [];

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Users size={24} className="sm:text-[32px] text-blue-500" />
              User Management
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Manage annotators and administrators</p>
          </div>
          <button
            onClick={handleCreate}
            className="w-full sm:w-auto bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm sm:text-base shadow-sm hover:shadow-md"
          >
            <Plus size={16} className="sm:text-[20px]" />
            Create Annotator
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="sm:text-[20px]" />
            Failed to load users.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {users.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Users size={48} className="sm:text-[64px] mx-auto text-gray-300 mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-600">No Users</h3>
                <p className="text-gray-500 text-sm sm:text-base mt-2">Create your first user to get started.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden xs:table-cell">
                          Email
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          Joined
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user._id} className="hover:bg-gray-50 transition">
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <User size={14} className="sm:text-[16px] text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-sm sm:text-base truncate block max-w-20 xs:max-w-none">
                                  {user.username}
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-500 block xs:hidden truncate max-w-20">
                                  {user.email}
                                </span>
                              </div>
                              {user._id === currentUser?._id && (
                                <span className="ml-1 sm:ml-2 text-[8px] sm:text-xs bg-green-100 text-green-800 px-1 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shrink-0">
                                  <CheckCircle size={8} className="sm:text-[12px]" />
                                  <span className="hidden xs:inline">You</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-gray-600 text-xs sm:text-sm hidden xs:table-cell">
                            {user.email}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                            <span
                              className={`px-1.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full flex items-center gap-1 w-fit ${
                                user.role === "Admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {user.role === "Admin" ? (
                                <Shield size={10} className="sm:text-[12px]" />
                              ) : (
                                <User size={10} className="sm:text-[12px]" />
                              )}
                              <span className="hidden xs:inline">{user.role}</span>
                              <span className="xs:hidden">{user.role === "Admin" ? "A" : "An"}</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-gray-500 text-[10px] sm:text-sm hidden sm:table-cell">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-blue-600 hover:text-blue-800 transition p-1 sm:p-1.5 hover:bg-blue-50 rounded-lg"
                                title="Edit user"
                              >
                                <Edit size={14} className="sm:text-[16px]" />
                              </button>
                              <button
                                onClick={() => handleDelete(user._id, user.username)}
                                disabled={
                                  deleteMutation.isPending || 
                                  user._id === currentUser?._id
                                }
                                className={`p-1 sm:p-1.5 rounded-lg transition ${
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
                                <Trash2 size={14} className="sm:text-[16px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {users.length > 0 && (
                  <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-t border-gray-200 text-[10px] sm:text-sm text-gray-500">
                    Total users: {users.length}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <UserModal
          isOpen={showModal}
          mode={modalMode}
          initialData={editingUser}
          onSubmit={modalMode === 'create' ? handleCreateSubmit : handleUpdateSubmit}
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
            setError("");
          }}
          isLoading={
            modalMode === 'create'
              ? createMutation.isPending
              : updateMutation.isPending
          }
          error={error}
          setError={setError}
        />
      </div>
    </div>
  );
}

export default UserManagement;