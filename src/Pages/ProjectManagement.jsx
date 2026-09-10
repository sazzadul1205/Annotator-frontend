import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  getProjects,
  deleteProject,
  getUsers,
  downloadCommentsCSV,
  downloadCommentsExcel,
  updateProject,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import CreateProjectModal from "../components/CreateProjectModal";
import EditProjectModal from "../components/EditProjectModal";
import VersionHistoryModal from "../components/VersionHistoryModal";
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
  Search,
  Filter,
  X,
  Download,
  FileSpreadsheet,
  History,
  FolderEdit,
} from "lucide-react";

function ProjectManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloading, setDownloading] = useState({ id: null, type: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Edit & History state
  const [editingProject, setEditingProject] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [historyProject, setHistoryProject] = useState(null);

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
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
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
        text:
          err.response?.data?.error ||
          "Failed to delete project. Please try again.",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditProject = async (form) => {
    if (!editingProject) return;
    setEditLoading(true);
    try {
      await updateProject(editingProject._id, form);
      setEditingProject(null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await refetch();
      Swal.fire({
        icon: "success",
        title: "Project Updated",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Update error:", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.response?.data?.error || "Failed to update project",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDownload = async (e, project, type /* "csv" | "excel" */) => {
    e.stopPropagation();

    if (!project.totalComments) return;

    setDownloading({ id: project._id, type });

    try {
      const fetcher =
        type === "excel" ? downloadCommentsExcel : downloadCommentsCSV;
      const response = await fetcher(project._id);

      const ext = type === "excel" ? "xlsx" : "csv";
      const mime =
        type === "excel"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv";

      const blob = new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `project_${project.name.replace(/\s+/g, "_")}_comments.${ext}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Download Started",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(`${type} download error:`, err);

      let errorMessage = `Failed to download ${type.toUpperCase()}`;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.error || errorMessage;
        } catch {
          /* ignore parse errors */
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: errorMessage,
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setDownloading({ id: null, type: null });
    }
  };

  const projects = data?.data?.data || [];
  const users = usersData?.data?.data || [];

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.assignedToUsername
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? project.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: {
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        icon: Clock,
        label: "Pending",
        dotColor: "bg-yellow-400",
      },
      in_progress: {
        color: "bg-blue-50 text-blue-700 border-blue-200",
        icon: FileText,
        label: "In Progress",
        dotColor: "bg-blue-400",
      },
      completed: {
        color: "bg-green-50 text-green-700 border-green-200",
        icon: CheckCircle,
        label: "Completed",
        dotColor: "bg-green-400",
      },
    };
    const s = statusMap[status] || statusMap.pending;
    const Icon = s.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-full border ${s.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
        <Icon size={10} className="sm:text-[12px]" />
        <span className="hidden xs:inline">{s.label}</span>
        <span className="xs:hidden">{s.label.charAt(0)}</span>
      </span>
    );
  };

  // Get project stats
  const totalProjects = projects.length;
  const totalComments = projects.reduce(
    (sum, p) => sum + (p.totalComments || 0),
    0
  );
  const totalValidated = projects.reduce(
    (sum, p) => sum + (p.validatedCount || 0),
    0
  );
  const completionRate =
    totalComments > 0 ? Math.round((totalValidated / totalComments) * 100) : 0;

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
  };

  const hasActiveFilters = searchTerm || statusFilter;
  const isAdmin = user?.role === "Admin";

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen overflow-x-hidden bg-gray-50">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <FolderOpen size={24} className="sm:text-[32px] text-blue-500" />
              Dashboard
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Manage and track your annotation projects
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <Plus size={18} className="sm:text-[20px]" />
              New Project
            </button>
          )}
        </div>

        {/* Stats Cards */}
        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Projects
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">
                {totalProjects}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Comments
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">
                {totalComments}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Validated
              </p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                {totalValidated}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completion Rate
              </p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">
                {completionRate}%
              </p>
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        {!isLoading && !isError && projects.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-37.5 sm:min-w-50">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search projects..."
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

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors cursor-pointer min-w-30"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <Filter
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
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
                {filteredProjects.length}{" "}
                {filteredProjects.length === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-gray-500 text-sm mt-4">Loading projects...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <span>Failed to load projects. Please try again.</span>
            <button
              onClick={() => refetch()}
              className="ml-auto text-red-700 hover:text-red-900 font-medium underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredProjects.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-16 text-center">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <FolderOpen size={48} className="sm:text-[56px] text-gray-300" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-700">
                {projects.length === 0
                  ? "No Projects Yet"
                  : "No matching projects"}
              </h3>
              <p className="text-gray-500 text-sm sm:text-base mt-2 max-w-md">
                {projects.length === 0
                  ? isAdmin
                    ? "Create your first project to get started with annotation."
                    : "You have no projects assigned to you yet."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {projects.length === 0 && isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
                >
                  <Plus size={16} />
                  Create Project
                </button>
              )}
              {projects.length > 0 && hasActiveFilters && (
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

        {/* Projects Grid */}
        {!isLoading && !isError && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredProjects.map((project) => (
              <div
                key={project._id}
                className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="p-4 sm:p-5">
                  {/* Header with Status */}
                  <div className="flex justify-between items-start gap-3 mb-2.5">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-xs sm:text-sm mb-4 line-clamp-2 min-h-10">
                    {project.description || "No description provided"}
                  </p>

                  {/* Stats */}
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Users
                          size={13}
                          className="sm:text-[14px] text-gray-400"
                        />
                        Assigned to
                      </span>
                      <span
                        className="font-medium text-gray-700 truncate max-w-30 sm:max-w-37.5"
                        title={project.assignedToUsername}
                      >
                        {project.assignedToUsername}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <FileText
                          size={13}
                          className="sm:text-[14px] text-gray-400"
                        />
                        Progress
                      </span>
                      <span className="font-medium text-gray-700">
                        {project.validatedCount || 0} /{" "}
                        {project.totalComments || 0}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative pt-1">
                      <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div
                          className={`h-1.5 sm:h-2 rounded-full transition-all duration-700 ease-out ${
                            project.totalComments > 0 &&
                            (project.validatedCount || 0) /
                              project.totalComments ===
                              1
                              ? "bg-green-500"
                              : "bg-blue-500"
                          }`}
                          style={{
                            width:
                              project.totalComments > 0
                                ? `${
                                    ((project.validatedCount || 0) /
                                      project.totalComments) *
                                    100
                                  }%`
                                : "0%",
                          }}
                        />
                      </div>
                      <span className="absolute right-0 -top-4 text-[10px] font-medium text-gray-400">
                        {project.totalComments > 0
                          ? `${Math.round(
                              ((project.validatedCount || 0) /
                                project.totalComments) *
                                100
                            )}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-1.5 mt-4 pt-3.5 border-t border-gray-100">
                    {/* Edit Project — Admin only */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project);
                        }}
                        className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                        title="Edit Project"
                      >
                        <FolderEdit size={17} className="sm:text-[18px]" />
                      </button>
                    )}

                    {/* Version History */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistoryProject(project);
                      }}
                      className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-200"
                      title="Version History"
                    >
                      <History size={17} className="sm:text-[18px]" />
                    </button>

                    {/* Download CSV — Admin only */}
                    {isAdmin && project.totalComments > 0 && (
                      <button
                        onClick={(e) => handleDownload(e, project, "csv")}
                        disabled={downloading.id === project._id}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          downloading.id === project._id
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                        title="Download CSV"
                      >
                        {downloading.id === project._id &&
                        downloading.type === "csv" ? (
                          <Loader2
                            size={17}
                            className="sm:text-[18px] animate-spin"
                          />
                        ) : (
                          <Download size={17} className="sm:text-[18px]" />
                        )}
                      </button>
                    )}

                    {/* Download Excel — Admin only */}
                    {isAdmin && project.totalComments > 0 && (
                      <button
                        onClick={(e) => handleDownload(e, project, "excel")}
                        disabled={downloading.id === project._id}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          downloading.id === project._id
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                        }`}
                        title="Download Excel"
                      >
                        {downloading.id === project._id &&
                        downloading.type === "excel" ? (
                          <Loader2
                            size={17}
                            className="sm:text-[18px] animate-spin"
                          />
                        ) : (
                          <FileSpreadsheet
                            size={17}
                            className="sm:text-[18px]"
                          />
                        )}
                      </button>
                    )}

                    {/* View */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project._id}`);
                      }}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                      title="View Project"
                    >
                      <Eye size={17} className="sm:text-[18px]" />
                    </button>

                    {/* Delete — Admin only */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project._id, project.name);
                        }}
                        disabled={deletingId === project._id}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          deletingId === project._id
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-red-500 hover:text-red-700 hover:bg-red-50"
                        }`}
                        title="Delete Project"
                      >
                        {deletingId === project._id ? (
                          <Loader2
                            size={17}
                            className="sm:text-[18px] animate-spin"
                          />
                        ) : (
                          <Trash2 size={17} className="sm:text-[18px]" />
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

        {/* Edit Project Modal */}
        {editingProject && (
          <EditProjectModal
            isOpen={!!editingProject}
            onClose={() => setEditingProject(null)}
            project={editingProject}
            users={users}
            onSubmit={handleEditProject}
            isLoading={editLoading}
          />
        )}

        {/* Version History Modal */}
        {historyProject && (
          <VersionHistoryModal
            isOpen={!!historyProject}
            onClose={() => setHistoryProject(null)}
            entityType="Project"
            entityId={historyProject._id}
            entityName={historyProject.name}
            onReverted={async () => {
              await queryClient.invalidateQueries({ queryKey: ["projects"] });
              await refetch();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default ProjectManagement;