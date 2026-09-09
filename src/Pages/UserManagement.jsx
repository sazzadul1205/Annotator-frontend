import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Search,
  X,
  Filter,
  Mail,
} from "lucide-react";

function UserManagement() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const handleCreateSubmit = async (userData) => {
    if (!userData.username || !userData.email || !userData.password) {
      setError("All fields are required");
      return;
    }
    if (userData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      await createAccount(userData);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await refetch();
      setShowModal(false);
      setError("");
      Swal.fire({
        icon: "success",
        title: "User Created!",
        text: "New annotator has been added successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user");
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: err.response?.data?.error || "Failed to create user",
        confirmButtonColor: "#3B82F6",
      });
    }
  };

  const handleUpdateSubmit = async (userData) => {
    const updateData = {};
    if (userData.username) updateData.username = userData.username;
    if (userData.email) updateData.email = userData.email;
    if (userData.password) updateData.password = userData.password;
    if (userData.role) updateData.role = userData.role;
    
    try {
      await updateAccount(userData._id, updateData);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await refetch();
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
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user");
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.response?.data?.error || "Failed to update user",
        confirmButtonColor: "#3B82F6",
      });
    }
  };

  const handleDelete = async (userId, username) => {
    if (userId === currentUser?._id) {
      Swal.fire({
        icon: "warning",
        title: "Cannot Delete",
        text: "You cannot delete your own account!",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }
    
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${username}". This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, delete user",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        await deleteAccount(userId);
        await queryClient.invalidateQueries({ queryKey: ["users"] });
        await refetch();
        Swal.fire({
          icon: "success",
          title: "User Deleted!",
          text: "User has been removed successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: err.response?.data?.error || "Failed to delete user",
          confirmButtonColor: "#3B82F6",
        });
      }
    }
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

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter ? user.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  // Get stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'Admin').length;
  const annotatorCount = users.filter(u => u.role === 'Annotator').length;

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
  };

  const hasActiveFilters = searchTerm || roleFilter;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen bg-gray-50 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Users size={24} className="sm:text-[32px] text-blue-500" />
              User Management
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Manage annotators and administrators
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <Plus size={18} className="sm:text-[20px]" />
            New User
          </button>
        </div>

        {/* Stats Cards */}
        {!isLoading && !isError && users.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{totalUsers}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Admins</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">{adminCount}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Annotators</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{annotatorCount}</p>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        {!isLoading && !isError && users.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-37.5 sm:min-w-50">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors placeholder:text-gray-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Role Filter */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="appearance-none px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors cursor-pointer min-w-30"
                >
                  <option value="">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Annotator">Annotator</option>
                </select>
                <Filter size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                >
                  Clear filters
                </button>
              )}

              {/* Results Count */}
              <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-500 text-sm mt-4">Loading users...</p>
          </div>
        )}
        
        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <span>Failed to load users. Please try again.</span>
            <button
              onClick={() => refetch()}
              className="ml-auto text-red-700 hover:text-red-900 font-medium underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredUsers.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-16 text-center">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Users size={48} className="sm:text-[56px] text-gray-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700">
                {users.length === 0 ? "No Users Yet" : "No matching users"}
              </h3>
              <p className="text-gray-500 text-sm sm:text-base mt-2 max-w-md">
                {users.length === 0
                  ? "Create your first user to get started with the platform."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {users.length === 0 && (
                <button
                  onClick={handleCreate}
                  className="mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
                >
                  <Plus size={16} />
                  Create User
                </button>
              )}
              {users.length > 0 && hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Users Table */}
        {!isLoading && !isError && filteredUsers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        User
                      </span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden xs:table-cell">
                      <span className="flex items-center gap-1.5">
                        <Mail size={14} className="text-gray-400" />
                        Email
                      </span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Shield size={14} className="text-gray-400" />
                        Role
                      </span>
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Joined
                    </th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                            user.role === "Admin" 
                              ? "bg-purple-100 text-purple-600" 
                              : "bg-blue-100 text-blue-600"
                          }`}>
                            <span className="text-xs sm:text-sm font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm sm:text-base truncate block max-w-20 xs:max-w-[120px] sm:max-w-none">
                                {user.username}
                              </span>
                              {user._id === currentUser?._id && (
                                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-green-100 text-green-700 text-[8px] sm:text-xs rounded-full font-medium shrink-0">
                                  <CheckCircle size={8} className="sm:text-[10px]" />
                                  <span className="hidden xs:inline">You</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] sm:text-xs text-gray-400 block xs:hidden truncate max-w-20">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-500 text-xs sm:text-sm hidden xs:table-cell">
                        {user.email}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full ${
                            user.role === "Admin"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
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
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-400 text-[10px] sm:text-sm hidden sm:table-cell">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1.5 sm:p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="Edit user"
                          >
                            <Edit size={15} className="sm:text-[17px]" />
                          </button>
                          <button
                            onClick={() => handleDelete(user._id, user.username)}
                            disabled={user._id === currentUser?._id}
                            className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${
                              user._id === currentUser?._id
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-red-500 hover:text-red-700 hover:bg-red-50"
                            }`}
                            title={
                              user._id === currentUser?._id
                                ? "Cannot delete your own account"
                                : "Delete user"
                            }
                          >
                            <Trash2 size={15} className="sm:text-[17px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] sm:text-sm text-gray-500">
                Showing {filteredUsers.length} of {users.length} users
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-sm text-gray-400">
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
                <button
                  onClick={() => refetch()}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Modal */}
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
          isLoading={false}
          error={error}
          setError={setError}
        />
      </div>
    </div>
  );
}

export default UserManagement;