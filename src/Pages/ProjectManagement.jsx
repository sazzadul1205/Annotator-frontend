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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: user?.role === "Admin",
  });

  const handleProjectCreated = async () => {
    await refetch();
  };

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
      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full flex items-center gap-1 w-fit ${s.color}`}>
        <Icon size={10} className="sm:text-[12px]" />
        <span className="hidden xs:inline">{s.label}</span>
        <span className="xs:hidden">{s.label.charAt(0)}</span>
      </span>
    );
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen size={24} className="sm:text-[32px] text-blue-500" />
            Projects
          </h1>
          {user?.role === "Admin" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus size={16} className="sm:text-[20px]" />
              Create Project
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="sm:text-[20px]" />
            Failed to load projects.
          </div>
        )}

        {!isLoading && !isError && projects.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
            <FolderOpen size={48} className="sm:text-[64px] mx-auto text-gray-300 mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600">No Projects Yet</h3>
            <p className="text-gray-500 text-sm sm:text-base mt-2">
              {user?.role === "Admin"
                ? "Create your first project to get started."
                : "You have no projects assigned to you yet."}
            </p>
            {user?.role === "Admin" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-600 transition text-sm sm:text-base"
              >
                Create Project
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                      {project.name}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>

                  <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                    {project.description || "No description"}
                  </p>

                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Users size={12} className="sm:text-[14px]" />
                        Assigned:
                      </span>
                      <span className="font-medium truncate max-w-25 sm:max-w-none">{project.assignedToUsername}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <FileText size={12} className="sm:text-[14px]" />
                        Progress:
                      </span>
                      <span className="font-medium">
                        {project.validatedCount || 0} / {project.totalComments || 0}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mt-1">
                      <div
                        className="bg-blue-500 rounded-full h-1.5 sm:h-2 transition-all"
                        style={{
                          width: project.totalComments > 0
                            ? `${((project.validatedCount || 0) / project.totalComments) * 100}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project._id}`);
                      }}
                      className="text-blue-600 hover:text-blue-800 transition p-1.5 hover:bg-blue-50 rounded"
                      title="View Project"
                    >
                      <Eye size={16} className="sm:text-[18px]" />
                    </button>
                    {user?.role === "Admin" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project._id, project.name);
                        }}
                        disabled={deletingId === project._id}
                        className={`text-red-600 hover:text-red-800 transition p-1.5 rounded ${
                          deletingId === project._id
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-red-50"
                        }`}
                        title="Delete Project"
                      >
                        {deletingId === project._id ? (
                          <Loader2 size={16} className="sm:text-[18px] animate-spin" />
                        ) : (
                          <Trash2 size={16} className="sm:text-[18px]" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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