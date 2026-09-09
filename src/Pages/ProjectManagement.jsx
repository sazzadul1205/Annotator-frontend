import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { getProjects, deleteProject, getUsers } from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import CreateProjectModal from "../components/CreateProjectModal";
import {
  FolderOpen,
  Plus,
  Trash2,
  Eye,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";

function ProjectManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch projects
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  // Fetch users for assignment (only if admin)
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: user?.role === "Admin",
  });

  // Handle project creation success - refetch projects
  const handleProjectCreated = async () => {
    await refetch();
  };

  // Direct delete function – no mutation
  const handleDelete = async (projectId, projectName) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${projectName}". This action cannot be undone! All comments in this project will also be permanently deleted.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, delete everything!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setDeletingId(projectId);
    try {
      const response = await deleteProject(projectId);
      // Invalidate and refetch projects list
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await refetch();
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: response?.data?.message || "Project deleted successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Delete error:", err);
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.response?.data?.error || "Failed to delete project. Please try again.",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const projects = data?.data?.data || [];
  const users = usersData?.data?.data || [];

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
      in_progress: { color: "bg-blue-100 text-blue-800", icon: FileText, label: "In Progress" },
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Completed" },
    };
    const s = statusMap[status] || statusMap.pending;
    const Icon = s.icon;
    return (
      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${s.color}`}>
        <Icon size={12} />
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen size={32} className="text-blue-500" />
            Projects
          </h1>
          {user?.role === "Admin" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
            >
              <Plus size={20} />
              Create Project
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            Failed to load projects.
          </div>
        )}

        {!isLoading && !isError && projects.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FolderOpen size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">No Projects Yet</h3>
            <p className="text-gray-500 mt-2">
              {user?.role === "Admin"
                ? "Create your first project to get started."
                : "You have no projects assigned to you yet."}
            </p>
            {user?.role === "Admin" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Create Project
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {project.name}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {project.description || "No description"}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Users size={14} />
                        Assigned to:
                      </span>
                      <span className="font-medium">{project.assignedToUsername}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <FileText size={14} />
                        Progress:
                      </span>
                      <span className="font-medium">
                        {project.validatedCount || 0} / {project.totalComments || 0}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-500 rounded-full h-2 transition-all"
                        style={{
                          width: project.totalComments > 0
                            ? `${((project.validatedCount || 0) / project.totalComments) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project._id}`);
                      }}
                      className="text-blue-600 hover:text-blue-800 transition p-1 hover:bg-blue-50 rounded"
                      title="View Project"
                    >
                      <Eye size={18} />
                    </button>
                    {user?.role === "Admin" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project._id, project.name);
                        }}
                        disabled={deletingId === project._id}
                        className={`text-red-600 hover:text-red-800 transition p-1 rounded ${
                          deletingId === project._id
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-red-50"
                        }`}
                        title="Delete Project"
                      >
                        {deletingId === project._id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <CreateProjectModal
            onClose={() => setShowCreateModal(false)}
            users={users}
            onProjectCreated={handleProjectCreated}
          />
        )}
      </div>
    </div>
  );
}

export default ProjectManagement;