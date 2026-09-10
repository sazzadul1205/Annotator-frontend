import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProject,
  getComments,
  uploadFileToProject,
  validateComment,
  getUnvalidatedCount,
  downloadCommentsCSV,
  deleteProject,
  downloadCommentsExcel,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import FileUploadModal from "../components/FileUploadModal";
import { useAuth } from "../hooks/useAuth";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Upload,
  FileText,
  Clock,
  Filter,
  Search,
  RefreshCw,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

const UPLOAD_STATE_KEY = "uploadState";
const DELETE_STATE_KEY = "deleteState";

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showValidated, setShowValidated] = useState(false);
  const [filters, setFilters] = useState({
    language: "",
    sentiment: "",
    search: "",
  });
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [validatingIds, setValidatingIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [tempSelections, setTempSelections] = useState({});
  const stateRestored = useRef(false);

  useEffect(() => {
    if (stateRestored.current) return;

    const savedUploadState = sessionStorage.getItem(UPLOAD_STATE_KEY);
    if (savedUploadState) {
      try {
        const state = JSON.parse(savedUploadState);
        if (state.projectId === projectId && state.uploading) {
          setTimeout(() => {
            setUploading(true);
          }, 0);
        }
      } catch (e) {
        console.error("Error parsing upload state:", e);
      }
    }

    const savedDeleteState = sessionStorage.getItem(DELETE_STATE_KEY);
    if (savedDeleteState) {
      try {
        const state = JSON.parse(savedDeleteState);
        if (state.projectId === projectId && state.deleting) {
          setTimeout(() => {
            setIsDeleting(true);
          }, 0);
        }
      } catch (e) {
        console.error("Error parsing delete state:", e);
      }
    }

    stateRestored.current = true;
  }, [projectId]);

  const { data: projectData, error: projectError, refetch: refetchProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: false,
  });

  useEffect(() => {
    if (projectError?.response?.status === 404) {
      sessionStorage.removeItem(UPLOAD_STATE_KEY);
      sessionStorage.removeItem(DELETE_STATE_KEY);

      Swal.fire({
        icon: "error",
        title: "Project Not Found",
        text: "The project may have been deleted.",
        confirmButtonColor: "#3B82F6",
      }).then(() => {
        navigate("/projects");
      });
    }
  }, [projectError, navigate]);

  const queryParams = {
    page,
    limit,
    ...filters,
  };
  if (!showValidated) {
    queryParams.isValidated = "false";
  }

  const {
    data: commentsData,
    isLoading,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ["comments", projectId, page, limit, showValidated, filters],
    queryFn: () => getComments(projectId, queryParams),
  });

  const { data: unvalidatedData, refetch: refetchUnvalidated } = useQuery({
    queryKey: ["unvalidated-count", projectId],
    queryFn: () => getUnvalidatedCount(projectId),
  });

  const project = projectData?.data?.data;
  const comments = commentsData?.data?.data?.comments || [];
  const pagination = commentsData?.data?.data?.pagination || {};
  const unvalidatedCount = unvalidatedData?.data?.data?.unvalidatedCount || 0;
  const fileUploaded = !!project?.fileInfo;

  const handleValidate = async (commentId, language, sentiment) => {
    if (!language || !sentiment) {
      Swal.fire({
        icon: "warning",
        title: "Missing Selection",
        text: "Please select both language and sentiment",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }

    setValidatingIds((prev) => new Set(prev).add(commentId));

    const previousComments = queryClient.getQueryData([
      "comments",
      projectId,
      page,
      limit,
      showValidated,
      filters,
    ]);
    const previousProject = queryClient.getQueryData(["project", projectId]);
    const previousUnvalidated = queryClient.getQueryData(["unvalidated-count", projectId]);

    queryClient.setQueryData(
      ["comments", projectId, page, limit, showValidated, filters],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...old.data.data,
              comments: old.data.data.comments.map((comment) =>
                comment._id === commentId
                  ? {
                    ...comment,
                    language: language,
                    sentiment: sentiment,
                    isValidated: true,
                    validatedBy: user?.userId || "You",
                    validatedByUsername: user?.username || "You",
                    validatedAt: new Date().toISOString(),
                  }
                  : comment
              ),
            },
          },
        };
      }
    );

    queryClient.setQueryData(["unvalidated-count", projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: {
            unvalidatedCount: Math.max(0, (old.data?.data?.unvalidatedCount || 0) - 1),
          },
        },
      };
    });

    queryClient.setQueryData(["project", projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: {
            ...old.data.data,
            validatedCount: (old.data?.data?.validatedCount || 0) + 1,
          },
        },
      };
    });

    setTempSelections((prev) => {
      const newState = { ...prev };
      delete newState[commentId];
      return newState;
    });

    try {
      await validateComment(commentId, { language, sentiment });
    } catch (err) {
      console.error("Validation error:", err);

      if (previousComments) {
        queryClient.setQueryData(
          ["comments", projectId, page, limit, showValidated, filters],
          previousComments
        );
      }
      if (previousProject) {
        queryClient.setQueryData(["project", projectId], previousProject);
      }
      if (previousUnvalidated) {
        queryClient.setQueryData(["unvalidated-count", projectId], previousUnvalidated);
      }

      const errorMessage = err.response?.data?.error || "Failed to validate comment";
      Swal.fire({
        icon: "error",
        title: "Validation Failed",
        text: errorMessage,
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setValidatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);

    sessionStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify({
      projectId,
      uploading: true,
      fileName: file.name,
      timestamp: Date.now()
    }));

    const previousProject = queryClient.getQueryData(["project", projectId]);

    queryClient.setQueryData(["project", projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          data: {
            ...old.data.data,
            fileInfo: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
              _optimistic: true,
            },
            status: "in_progress",
          },
        },
      };
    });

    try {
      const response = await uploadFileToProject(projectId, file);

      sessionStorage.removeItem(UPLOAD_STATE_KEY);
      setShowUploadModal(false);

      await queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["unvalidated-count", projectId] });
      await refetchComments();
      await refetchUnvalidated();
      await refetchProject();

      Swal.fire({
        icon: "success",
        title: "Upload Successful",
        text: response?.data?.message || "File uploaded and comments imported.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Upload error:", err);
      sessionStorage.removeItem(UPLOAD_STATE_KEY);

      if (previousProject) {
        queryClient.setQueryData(["project", projectId], previousProject);
      }

      const errorMessage = err.response?.data?.error || "Upload failed";
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: errorMessage,
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProject = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${project?.name}". This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, delete!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);

    sessionStorage.setItem(DELETE_STATE_KEY, JSON.stringify({
      projectId,
      deleting: true,
      timestamp: Date.now()
    }));

    try {
      const response = await deleteProject(projectId);

      sessionStorage.removeItem(DELETE_STATE_KEY);

      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: response?.data?.message || "Project deleted successfully.",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        navigate("/projects");
      });
    } catch (err) {
      console.error("Delete error:", err);
      sessionStorage.removeItem(DELETE_STATE_KEY);

      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.response?.data?.error || "Failed to delete project.",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const response = await downloadCommentsCSV(projectId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `project_${project.name.replace(/\s+/g, "_")}_comments.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire({
        icon: "success",
        title: "Download Started",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Download error:", err);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.response?.data?.error || "Failed to download CSV",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await downloadCommentsExcel(projectId);

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `project_${project.name.replace(/\s+/g, "_")}_comments.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Download Started",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Excel download error:", err);

      let errorMessage = "Failed to download Excel";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.error || errorMessage;
        } catch {
          // ignore
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
      setDownloadingExcel(false);
    }
  };

  const clearFilters = () => {
    setFilters({ language: "", sentiment: "", search: "" });
    setPage(1);
  };

  const canValidate = user?.role !== "Viewer";
  const isAdmin = user?.role === "Admin";

  const pageSizeOptions = [10, 20, 50, 100];

  if (!project && !projectError) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-0 mb-4 sm:mb-6">
          <div className="w-full lg:w-auto min-w-0">
            <button
              onClick={() => navigate("/projects")}
              className="text-blue-600 hover:text-blue-800 transition flex items-center gap-1.5 mb-2 text-xs sm:text-sm font-medium group"
            >
              <ArrowLeft size={14} className="sm:text-[16px] transition-transform group-hover:-translate-x-0.5" />
              Back to Projects
            </button>

            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 wrap-break-word leading-tight">
              {project?.name}
            </h1>

            {project?.description && (
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5 wrap-break-word line-clamp-2 sm:line-clamp-none">
                {project.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <Users size={12} className="sm:text-[14px] text-gray-400" />
                <span className="truncate max-w-20 sm:max-w-30 md:max-w-none">
                  {project?.assignedToUsername}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <FileText size={12} className="sm:text-[14px] text-gray-400" />
                <span className="font-medium">{project?.validatedCount || 0}</span>
                <span className="text-gray-400">/</span>
                <span>{project?.totalComments || 0}</span>
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <Clock size={12} className="sm:text-[14px] text-gray-400" />
                <span className="font-medium text-yellow-600">{unvalidatedCount}</span>
                <span className="hidden xs:inline">pending</span>
              </span>
              {project?.status && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${project.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : project.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'completed'
                    ? 'bg-green-500'
                    : project.status === 'in_progress'
                      ? 'bg-blue-500'
                      : 'bg-yellow-500'
                    }`} />
                  {project.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons Group */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto mt-2 lg:mt-0">
            {/* Upload Button */}
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={fileUploaded || uploading}
                className={`
          relative flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 
          text-xs sm:text-sm font-medium rounded-xl 
          transition-all duration-200 
          flex items-center justify-center gap-1.5 sm:gap-2
          ${fileUploaded || uploading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-[0.98] shadow-sm"
                  }
        `}
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="sm:text-[16px] animate-spin" />
                    <span className="hidden xs:inline">Uploading...</span>
                    <span className="xs:hidden">...</span>
                  </>
                ) : fileUploaded ? (
                  <>
                    <CheckCircle size={14} className="sm:text-[16px]" />
                    <span className="hidden xs:inline">File Uploaded</span>
                    <span className="xs:hidden">✓</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} className="sm:text-[16px]" />
                    <span className="hidden xs:inline">Upload File</span>
                    <span className="xs:hidden">Upload</span>
                  </>
                )}
              </button>
            )}

            {/* Download CSV Button */}
            {isAdmin && (
              <button
                onClick={handleDownloadCSV}
                disabled={downloading || comments.length === 0}
                className={`
          relative flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 
          text-xs sm:text-sm font-medium rounded-xl 
          transition-all duration-200 
          flex items-center justify-center gap-1.5 sm:gap-2
          ${downloading || comments.length === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-[0.98] shadow-sm"
                  }
        `}
              >
                <Download size={14} className="sm:text-[16px]" />
                <span className="hidden xs:inline">
                  {downloading ? "Downloading..." : "Export CSV"}
                </span>
                <span className="xs:hidden">CSV</span>
              </button>
            )}

            {/* Download Excel Button */}
            {isAdmin && (
              <button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel || comments.length === 0}
                className={`
      relative flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 
      text-xs sm:text-sm font-medium rounded-xl 
      transition-all duration-200 
      flex items-center justify-center gap-1.5 sm:gap-2
      ${downloadingExcel || comments.length === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md active:scale-[0.98] shadow-sm"
                  }
    `}
              >
                <Download size={14} className="sm:text-[16px]" />
                <span className="hidden xs:inline">
                  {downloadingExcel ? "Downloading..." : "Export Excel"}
                </span>
                <span className="xs:hidden">XLSX</span>
              </button>
            )}

            {/* Delete Button */}
            {isAdmin && (
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className={`
          relative flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 
          text-xs sm:text-sm font-medium rounded-xl 
          transition-all duration-200 
          flex items-center justify-center gap-1.5 sm:gap-2
          ${isDeleting
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-red-600 text-white hover:bg-red-700 hover:shadow-md active:scale-[0.98] shadow-sm"
                  }
        `}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="sm:text-[16px] animate-spin" />
                    <span className="hidden xs:inline">Deleting...</span>
                    <span className="xs:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="sm:text-[16px]" />
                    <span className="hidden xs:inline">Delete</span>
                  </>
                )}
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => {
                refetchComments();
                refetchUnvalidated();
                refetchProject();
              }}
              className=" flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5  text-xs sm:text-sm font-medium rounded-xl  transition-all duration-200  flex items-center justify-center gap-1.5 sm:gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm active:scale-[0.98] border border-gray-200"
            >
              <RefreshCw size={14} className="sm:text-[16px]" />
              <span className="hidden xs:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4 sm:mb-6 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2 border-r border-gray-200 shrink-0">
              <Filter size={14} className="sm:text-[16px] text-blue-500" />
              <span className="text-xs sm:text-sm font-medium text-gray-700 hidden xs:inline">Filters</span>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <select
                value={filters.language}
                onChange={(e) => {
                  setFilters({ ...filters, language: e.target.value });
                  setPage(1);
                }}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1.5 pr-6 sm:pr-8 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors cursor-pointer 
                min-w-22.5 sm:min-w-32.5 appearance-none"
              >
                <option value="">All Languages</option>
                <option value="Bangla">Bangla</option>
                <option value="English">English</option>
                <option value="Banglish">Banglish</option>
                <option value="Emoji">Emoji</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={filters.sentiment}
                onChange={(e) => {
                  setFilters({ ...filters, sentiment: e.target.value });
                  setPage(1);
                }}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1.5 pr-6 sm:pr-8 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors cursor-pointer min-w-22.5 sm:min-w-32.5 appearance-none"
              >
                <option value="">All Sentiments</option>
                <option value="Positive">Positive</option>
                <option value="Negative">Negative</option>
                <option value="Neutral">Neutral</option>
              </select>
            </div>

            <div className="flex-1 min-w-25 sm:min-w-50 w-full sm:w-auto">
              <div className="relative">
                <Search size={14} className="sm:text-[16px] absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(1);
                  }}
                  className="w-full pl-8 sm:pl-9 pr-6 sm:pr-8 py-1.5 sm:py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors placeholder:text-gray-400"
                />
                {filters.search && (
                  <button
                    onClick={() => {
                      setFilters({ ...filters, search: "" });
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={clearFilters}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden xs:inline">Clear</span>
              </button>

              <div className="w-px h-6 bg-gray-200 hidden xs:block"></div>

              <button
                onClick={() => setShowValidated(!showValidated)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${showValidated
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
              >
                {showValidated ? (
                  <Eye size={13} className="sm:text-[15px] text-blue-500" />
                ) : (
                  <EyeOff size={13} className="sm:text-[15px] text-gray-400" />
                )}
                <span className="hidden xs:inline">{showValidated ? "Show Validated" : "Hide Validated"}</span>
                <span className="xs:hidden">{showValidated ? "Validated" : "Hide"}</span>
              </button>

              {(filters.language || filters.sentiment || filters.search) && (
                <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                  {[
                    filters.language && "L",
                    filters.sentiment && "S",
                    filters.search && "Q",
                  ].filter(Boolean).length}
                </span>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(filters.language || filters.sentiment || filters.search) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
              <span className="text-[10px] sm:text-xs text-gray-500 mr-1">Active:</span>
              {filters.language && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] sm:text-xs rounded-md border border-blue-200">
                  Lang: {filters.language}
                  <button
                    onClick={() => {
                      setFilters({ ...filters, language: "" });
                      setPage(1);
                    }}
                    className="hover:text-blue-900"
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.sentiment && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] sm:text-xs rounded-md border border-purple-200">
                  Sent: {filters.sentiment}
                  <button
                    onClick={() => {
                      setFilters({ ...filters, sentiment: "" });
                      setPage(1);
                    }}
                    className="hover:text-purple-900"
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.search && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-green-50 text-green-700 text-[10px] sm:text-xs rounded-md border border-green-200 max-w-30 sm:max-w-none">
                  <span className="truncate">"{filters.search}"</span>
                  <button
                    onClick={() => {
                      setFilters({ ...filters, search: "" });
                      setPage(1);
                    }}
                    className="hover:text-green-900 shrink-0"
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-[10px] sm:text-xs text-red-500 hover:text-red-700 ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12 sm:py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-xs sm:text-sm text-gray-500">Loading comments...</p>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-16 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <FileText size={32} className="sm:text-[48px] text-gray-300" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-700">No Comments Found</h3>
              <p className="text-gray-500 text-xs sm:text-sm mt-2 max-w-md">
                {isAdmin
                  ? fileUploaded
                    ? "No comments were extracted from the uploaded file."
                    : uploading
                      ? "Uploading file, please wait..."
                      : "Upload a file to get started with comments."
                  : "No comments available for this project."}
              </p>
              {uploading && (
                <div className="mt-3 sm:mt-4 flex items-center gap-2">
                  <Loader2 size={16} className="sm:text-[20px] animate-spin text-blue-500" />
                  <span className="text-xs sm:text-sm text-gray-500">Processing your file...</span>
                </div>
              )}
              {!fileUploaded && isAdmin && !uploading && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 sm:mt-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm"
                >
                  <Upload size={14} className="sm:text-[16px]" />
                  Upload File
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-8 sm:w-12">
                      #
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider min-w-30">
                      <div className="flex items-center gap-1">
                        <FileText size={12} className="sm:text-[14px]" />
                        Comment
                      </div>
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-28 sm:w-36">
                      Language
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-28 sm:w-36">
                      Sentiment
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sm:w-24">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-16 sm:w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {comments.map((comment, index) => {
                    const isPending = validatingIds.has(comment._id);
                    const isDisabled = comment.isValidated || !canValidate;

                    const tempLang = tempSelections[comment._id]?.language || "";
                    const tempSent = tempSelections[comment._id]?.sentiment || "";

                    return (
                      <tr
                        key={comment._id}
                        className={`group transition-colors ${comment.isValidated
                          ? "bg-gray-50/50 hover:bg-gray-50"
                          : "hover:bg-blue-50/30"
                          }`}
                      >
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-[10px] sm:text-sm text-gray-400 font-medium">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 max-w-37.5 sm:max-w-xs md:max-w-md wrap-break-word">
                          <div className="flex items-start gap-1 sm:gap-2">
                            <span className="text-gray-400 text-[8px] sm:text-xs mt-0.5">"</span>
                            <span className="wrap-break-word line-clamp-3 sm:line-clamp-none">{comment.text}</span>
                            <span className="text-gray-400 text-[8px] sm:text-xs mt-0.5">"</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-blue-50 text-blue-700 text-[10px] sm:text-sm font-medium rounded-md">
                              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full"></span>
                              {comment.language}
                            </span>
                          ) : (
                            <select
                              value={tempLang}
                              onChange={(e) => {
                                setTempSelections((prev) => ({
                                  ...prev,
                                  [comment._id]: {
                                    ...prev[comment._id],
                                    language: e.target.value,
                                  },
                                }));
                              }}
                              disabled={isDisabled}
                              className={`w-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 border rounded-lg text-[10px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDisabled
                                ? "bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200"
                                : "bg-white border-gray-200 hover:border-blue-300"
                                }`}
                            >
                              <option value="">Select</option>
                              <option value="Bangla">Bangla</option>
                              <option value="English">English</option>
                              <option value="Banglish">Banglish</option>
                              <option value="Emoji">Emoji</option>
                              <option value="Other">Other</option>
                            </select>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-sm font-medium rounded-md ${comment.sentiment === 'Positive'
                              ? 'bg-green-50 text-green-700'
                              : comment.sentiment === 'Negative'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-50 text-gray-700'
                              }`}>
                              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${comment.sentiment === 'Positive'
                                ? 'bg-green-500'
                                : comment.sentiment === 'Negative'
                                  ? 'bg-red-500'
                                  : 'bg-gray-400'
                                }`}></span>
                              {comment.sentiment}
                            </span>
                          ) : (
                            <select
                              value={tempSent}
                              onChange={(e) => {
                                setTempSelections((prev) => ({
                                  ...prev,
                                  [comment._id]: {
                                    ...prev[comment._id],
                                    sentiment: e.target.value,
                                  },
                                }));
                              }}
                              disabled={isDisabled}
                              className={`w-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 border rounded-lg text-[10px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDisabled
                                ? "bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200"
                                : "bg-white border-gray-200 hover:border-blue-300"
                                }`}
                            >
                              <option value="">Select</option>
                              <option value="Positive">Positive</option>
                              <option value="Negative">Negative</option>
                              <option value="Neutral">Neutral</option>
                            </select>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-xs font-medium text-green-700 bg-green-100 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                              <CheckCircle size={10} className="sm:text-[13px] text-green-500" />
                              <span className="hidden xs:inline">Validated</span>
                              <span className="xs:hidden">✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-xs font-medium text-yellow-700 bg-yellow-100 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                              <Clock size={10} className="sm:text-[13px] text-yellow-500" />
                              <span className="">Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                          {!comment.isValidated && canValidate ? (
                            <button
                              onClick={() => {
                                handleValidate(comment._id, tempLang, tempSent);
                              }}
                              disabled={isPending || !tempLang || !tempSent}
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[8px] sm:text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-1 sm:gap-1.5 ${isPending || !tempLang || !tempSent
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow"
                                }`}
                            >
                              {isPending ? (
                                <>
                                  <span className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 border-2 border-white border-t-transparent"></span>
                                  <span className="hidden xs:inline">Saving...</span>
                                  <span className="xs:hidden">...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={10} className="sm:text-[13px]" />
                                  <span className="hidden xs:inline">Save</span>
                                  <span className="xs:hidden">✓</span>
                                </>
                              )}
                            </button>
                          ) : comment.isValidated ? (
                            <span className="text-[8px] sm:text-xs text-gray-400 flex items-center gap-1">
                              <CheckCircle size={10} className="sm:text-[13px] text-gray-300" />
                              <span className="hidden xs:inline">Done</span>
                            </span>
                          ) : (
                            <span className="text-[8px] sm:text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-sm text-gray-600">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] sm:text-sm text-gray-600 hidden xs:inline">
                  {pagination.total
                    ? `${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                    : "0 entries"}
                </span>
                <span className="text-[10px] sm:text-sm text-gray-600 xs:hidden">
                  {pagination.total || 0}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 sm:p-1.5 rounded-lg border border-gray-200 hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} className="sm:text-[16px] text-gray-600" />
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-sm text-gray-600">
                    <span className="font-medium text-gray-800">{page}</span>
                    <span className="hidden xs:inline"> of <span className="font-medium text-gray-800">{pagination.totalPages || 1}</span></span>
                  </span>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={page === pagination.totalPages || pagination.totalPages === 0}
                  className="p-1 sm:p-1.5 rounded-lg border border-gray-200 hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} className="sm:text-[16px] text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setUploading(false);
          }}
          onUpload={handleFileUpload}
          isLoading={uploading}
        />
      )}
    </div>
  );
}

export default ProjectDetail;