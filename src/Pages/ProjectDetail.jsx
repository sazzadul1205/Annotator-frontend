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

// Session storage keys
const UPLOAD_STATE_KEY = "uploadState";
const DELETE_STATE_KEY = "deleteState";

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Pagination & filters
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
  const [validatingIds, setValidatingIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Temporary selections for language and sentiment per comment
  const [tempSelections, setTempSelections] = useState({});

  // Use ref to track if state has been restored
  const stateRestored = useRef(false);

  // 🎯 Restore upload state from sessionStorage on page refresh
  useEffect(() => {
    if (stateRestored.current) return;

    const savedUploadState = sessionStorage.getItem(UPLOAD_STATE_KEY);
    if (savedUploadState) {
      try {
        const state = JSON.parse(savedUploadState);
        if (state.projectId === projectId && state.uploading) {
          // Use a timeout to avoid cascade renders
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

  // Fetch project details
  const { data: projectData, error: projectError, refetch: refetchProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: false,
  });

  // Redirect if project not found or deleted
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

  // Build query params for comments
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

  // Check if file has already been uploaded
  const fileUploaded = !!project?.fileInfo;

  // 📝 Validate single comment - OPTIMISTIC UPDATE without mutation
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

  // 📤 File upload - PERSISTENT STATE
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

  // 🗑️ Delete project with persistent state
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

  // 📥 Download CSV
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

  const clearFilters = () => {
    setFilters({ language: "", sentiment: "", search: "" });
    setPage(1);
  };

  const canValidate = user?.role !== "Viewer";
  const isAdmin = user?.role === "Admin";

  const pageSizeOptions = [10, 20, 50, 100];

  // Show loading while fetching project
  if (!project && !projectError) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 p-8 w-full">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button
              onClick={() => navigate("/projects")}
              className="text-blue-600 hover:text-blue-800 transition flex items-center gap-1 mb-2 text-sm"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{project?.name}</h1>
            <p className="text-gray-600 text-sm">{project?.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1 text-gray-500">
                <Users size={14} />
                {project?.assignedToUsername}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <FileText size={14} />
                {project?.validatedCount || 0}/{project?.totalComments || 0}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Clock size={14} />
                {unvalidatedCount} pending
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Upload Button - Opens Modal */}
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={fileUploaded || uploading}
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${fileUploaded || uploading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : fileUploaded ? (
                  <>
                    <CheckCircle size={16} />
                    Uploaded
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload
                  </>
                )}
              </button>
            )}

            {/* Download CSV Button */}
            {isAdmin && (
              <button
                onClick={handleDownloadCSV}
                disabled={downloading || comments.length === 0}
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${downloading || comments.length === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
              >
                <Download size={16} />
                {downloading ? "Downloading..." : "CSV"}
              </button>
            )}

            {/* Delete Project Button */}
            {isAdmin && (
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${isDeleting
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-500 text-white hover:bg-red-600"
                  }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                refetchComments();
                refetchUnvalidated();
                refetchProject();
              }}
              className="bg-gray-200 text-gray-700 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition flex items-center gap-1.5"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Label */}
            <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
              <Filter size={16} className="text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Filters</span>
            </div>

            {/* Language Filter */}
            <div className="relative">
              <select
                value={filters.language}
                onChange={(e) => {
                  setFilters({ ...filters, language: e.target.value });
                  setPage(1);
                }}
                className="appearance-none px-3 py-1.5 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors cursor-pointer min-w-32.5"
              >
                <option value="">All Languages</option>
                <option value="Bangla">Bangla</option>
                <option value="English">English</option>
                <option value="Banglish">Banglish</option>
                <option value="Emoji">Emoji</option>
                <option value="Other">Other</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Sentiment Filter */}
            <div className="relative">
              <select
                value={filters.sentiment}
                onChange={(e) => {
                  setFilters({ ...filters, sentiment: e.target.value });
                  setPage(1);
                }}
                className="appearance-none px-3 py-1.5 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors cursor-pointer min-w-32.5"
              >
                <option value="">All Sentiments</option>
                <option value="Positive">Positive</option>
                <option value="Negative">Negative</option>
                <option value="Neutral">Neutral</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-white transition-colors placeholder:text-gray-400"
                />
                {filters.search && (
                  <button
                    onClick={() => {
                      setFilters({ ...filters, search: "" });
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Clear Filters Button */}
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>

              <div className="w-px h-6 bg-gray-200"></div>

              {/* Toggle Validated Button */}
              <button
                onClick={() => setShowValidated(!showValidated)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${showValidated
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
              >
                {showValidated ? (
                  <Eye size={15} className="text-blue-500" />
                ) : (
                  <EyeOff size={15} className="text-gray-400" />
                )}
                {showValidated ? "Show Validated" : "Hide Validated"}
              </button>

              {/* Active Filters Count Badge */}
              {(filters.language || filters.sentiment || filters.search) && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                  {[
                    filters.language && "Lang",
                    filters.sentiment && "Sent",
                    filters.search && "Search",
                  ].filter(Boolean).length}
                </span>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(filters.language || filters.sentiment || filters.search) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500 mr-1">Active filters:</span>
              {filters.language && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                  Language: {filters.language}
                  <button
                    onClick={() => {
                      setFilters({ ...filters, language: "" });
                      setPage(1);
                    }}
                    className="hover:text-blue-900"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.sentiment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-200">
                  Sentiment: {filters.sentiment}
                  <button
                    onClick={() => {
                      setFilters({ ...filters, sentiment: "" });
                      setPage(1);
                    }}
                    className="hover:text-purple-900"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-md border border-green-200">
                  Search: {filters.search}
                  <button
                    onClick={() => {
                      setFilters({ ...filters, search: "" });
                      setPage(1);
                    }}
                    className="hover:text-green-900"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-xs text-red-500 hover:text-red-700 ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-sm text-gray-500">Loading comments...</p>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <FileText size={48} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">No Comments Found</h3>
              <p className="text-gray-500 text-sm mt-2 max-w-md">
                {isAdmin
                  ? fileUploaded
                    ? "No comments were extracted from the uploaded file."
                    : uploading
                      ? "Uploading file, please wait..."
                      : "Upload a file to get started with comments."
                  : "No comments available for this project."}
              </p>
              {uploading && (
                <div className="mt-4 flex items-center gap-2">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500">Processing your file...</span>
                </div>
              )}
              {!fileUploaded && isAdmin && !uploading && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                >
                  <Upload size={16} />
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <FileText size={14} />
                        Comment
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Language
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Sentiment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-medium">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-md wrap-break-word">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 text-xs mt-0.5">"</span>
                            <span>{comment.text}</span>
                            <span className="text-gray-400 text-xs mt-0.5">"</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-md">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
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
                              className={`w-full px-2.5 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDisabled
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md ${comment.sentiment === 'Positive'
                              ? 'bg-green-50 text-green-700'
                              : comment.sentiment === 'Negative'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-50 text-gray-700'
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${comment.sentiment === 'Positive'
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
                              className={`w-full px-2.5 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${isDisabled
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                              <CheckCircle size={13} className="text-green-500" />
                              Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">
                              <Clock size={13} className="text-yellow-500" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!comment.isValidated && canValidate ? (
                            <button
                              onClick={() => {
                                handleValidate(comment._id, tempLang, tempSent);
                              }}
                              disabled={isPending || !tempLang || !tempSent}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${isPending || !tempLang || !tempSent
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow"
                                }`}
                            >
                              {isPending ? (
                                <>
                                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={13} />
                                  Save
                                </>
                              )}
                            </button>
                          ) : comment.isValidated ? (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <CheckCircle size={13} className="text-gray-300" />
                              Done
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-600">
                  {pagination.total
                    ? `${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                    : "0 entries"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">
                    Page <span className="font-medium text-gray-800">{page}</span> of{" "}
                    <span className="font-medium text-gray-800">{pagination.totalPages || 1}</span>
                  </span>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={page === pagination.totalPages || pagination.totalPages === 0}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} className="text-gray-600" />
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