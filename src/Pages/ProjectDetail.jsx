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
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(file.type)) {
      Swal.fire({
        icon: "error",
        title: "Invalid File",
        text: "Please upload a CSV or Excel file",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: "File size must be less than 50MB",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }

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
            {/* Upload Button */}
            {isAdmin && (
              <label
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  fileUploaded || uploading
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
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading || fileUploaded}
                />
              </label>
            )}

            {/* Download CSV Button */}
            {isAdmin && (
            <button
              onClick={handleDownloadCSV}
              disabled={downloading || comments.length === 0}
              className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${
                downloading || comments.length === 0
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
                className={`px-3 py-1.5 text-sm rounded-lg transition flex items-center gap-1.5 ${
                  isDeleting
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
        <div className="bg-white rounded-lg shadow p-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <select
              value={filters.language}
              onChange={(e) => {
                setFilters({ ...filters, language: e.target.value });
                setPage(1);
              }}
              className="px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Neutral">Neutral</option>
            </select>

            <div className="flex-1 min-w-40">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(1);
                  }}
                  className="w-full pl-7 pr-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button onClick={clearFilters} className="text-red-600 hover:text-red-800 text-sm">
              Clear
            </button>

            <button
              onClick={() => setShowValidated(!showValidated)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition ${
                showValidated
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {showValidated ? <Eye size={14} /> : <EyeOff size={14} />}
              {showValidated ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">No Comments Found</h3>
            <p className="text-gray-500 text-sm mt-2">
              {isAdmin
                ? fileUploaded
                  ? "No comments were extracted from the uploaded file."
                  : uploading 
                    ? "Uploading file, please wait..."
                    : "Upload a file to get started."
                : "No comments available for this project."}
            </p>
            {uploading && (
              <div className="mt-4 flex justify-center">
                <Loader2 size={32} className="animate-spin text-blue-500" />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comment
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Language
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Sentiment
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comments.map((comment, index) => {
                    const isPending = validatingIds.has(comment._id);
                    const isDisabled = comment.isValidated || !canValidate;

                    const tempLang = tempSelections[comment._id]?.language || "";
                    const tempSent = tempSelections[comment._id]?.sentiment || "";

                    return (
                      <tr
                        key={comment._id}
                        className={`${
                          comment.isValidated ? "bg-gray-50 opacity-75" : "hover:bg-gray-50"
                        } transition`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800 wrap-break-word max-w-md">
                          {comment.text}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="text-sm font-medium text-gray-700">
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
                              className={`px-2 py-0.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDisabled ? "bg-gray-100 cursor-not-allowed" : ""
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
                        <td className="px-3 py-2 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="text-sm font-medium text-gray-700">
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
                              className={`px-2 py-0.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDisabled ? "bg-gray-100 cursor-not-allowed" : ""
                              }`}
                            >
                              <option value="">Select</option>
                              <option value="Positive">Positive</option>
                              <option value="Negative">Negative</option>
                              <option value="Neutral">Neutral</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <CheckCircle size={12} />
                              Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                              <Clock size={12} />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {!comment.isValidated && canValidate ? (
                            <button
                              onClick={() => {
                                handleValidate(comment._id, tempLang, tempSent);
                              }}
                              disabled={isPending || !tempLang || !tempSent}
                              className={`px-2.5 py-1 text-xs rounded-lg transition ${
                                isPending || !tempLang || !tempSent
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              }`}
                            >
                              {isPending ? (
                                <span className="flex items-center gap-1">
                                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                                </span>
                              ) : (
                                "Save"
                              )}
                            </button>
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
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-gray-600">
                  {pagination.total
                    ? `${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-gray-600">
                  Page {page} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={page === pagination.totalPages || pagination.totalPages === 0}
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDetail;