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
  createComment,
  updateCommentText,
  deleteComment,
  bulkValidateComments,
  updateProject,
  getUsers,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import FileUploadModal from "../components/FileUploadModal";
import AddCommentModal from "../components/AddCommentModal";
import EditCommentModal from "../components/EditCommentModal";
import EditProjectModal from "../components/EditProjectModal";
import VersionHistoryModal from "../components/VersionHistoryModal";
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
  MessageSquarePlus,
  Edit,
  History,
  FolderEdit,
  CheckSquare,
  Square,
  X,
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
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Bulk selection
  const [selectedComments, setSelectedComments] = useState(new Set());
  const [bulkValidating, setBulkValidating] = useState(false);
  const [bulkSelections, setBulkSelections] = useState({});

  const [tempSelections, setTempSelections] = useState({});
  const stateRestored = useRef(false);

  useEffect(() => {
    if (stateRestored.current) return;
    const savedUploadState = sessionStorage.getItem(UPLOAD_STATE_KEY);
    if (savedUploadState) {
      try {
        const state = JSON.parse(savedUploadState);
        if (state.projectId === projectId && state.uploading) {
          setTimeout(() => setUploading(true), 0);
        }
      } catch {
        // Empty
      }
    }
    stateRestored.current = true;
  }, [projectId]);

  const { data: projectData, error: projectError, refetch: refetchProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: false,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: user?.role === "Admin",
  });

  useEffect(() => {
    if (projectError?.response?.status === 404) {
      sessionStorage.removeItem(UPLOAD_STATE_KEY);
      sessionStorage.removeItem(DELETE_STATE_KEY);
      Swal.fire({
        icon: "error",
        title: "Project Not Found",
        text: "The project may have been deleted.",
      }).then(() => navigate("/projects"));
    }
  }, [projectError, navigate]);

  const queryParams = { page, limit, ...filters };
  if (!showValidated) queryParams.isValidated = "false";

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
  const users = usersData?.data?.data || [];

  const canEdit = user?.role !== "Viewer";
  const isAdmin = user?.role === "Admin";

  /* ---- existing validate handler ---- */
  const handleValidate = async (commentId, language, sentiment) => {
    if (!language || !sentiment) {
      Swal.fire({
        icon: "warning",
        title: "Missing Selection",
        text: "Please select both language and sentiment",
      });
      return;
    }
    setValidatingIds((prev) => new Set(prev).add(commentId));
    try {
      await validateComment(commentId, { language, sentiment });
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unvalidated-count", projectId] });
      setTempSelections((prev) => {
        const s = { ...prev };
        delete s[commentId];
        return s;
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Validation Failed",
        text: err.response?.data?.error || "Failed to validate comment",
      });
    } finally {
      setValidatingIds((prev) => {
        const s = new Set(prev);
        s.delete(commentId);
        return s;
      });
    }
  };

  /* ---- Add comment ---- */
  const handleAddComment = async (form) => {
    try {
      await createComment(projectId, form);
      setShowAddCommentModal(false);
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unvalidated-count", projectId] });
      Swal.fire({
        icon: "success",
        title: "Comment added",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to add comment",
        text: err.response?.data?.error || "Error",
      });
    }
  };

  /* ---- Edit comment text ---- */
  const handleEditComment = async (text) => {
    if (!editingComment) return;
    try {
      await updateCommentText(editingComment._id, text);
      setEditingComment(null);
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      Swal.fire({
        icon: "success",
        title: "Comment updated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to update",
        text: err.response?.data?.error || "Error",
      });
    }
  };

  /* ---- Delete comment ---- */
  const handleDeleteComment = async (commentId) => {
    const confirm = await Swal.fire({
      title: "Delete this comment?",
      text: "This will also remove it from the project's counts.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "Delete",
    });
    if (!confirm.isConfirmed) return;

    setDeletingCommentId(commentId);
    try {
      await deleteComment(commentId);
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unvalidated-count", projectId] });
      Swal.fire({
        icon: "success",
        title: "Deleted",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.response?.data?.error || "Error",
      });
    } finally {
      setDeletingCommentId(null);
    }
  };

  /* ---- Bulk validate ---- */
  const handleBulkValidate = async () => {
    if (selectedComments.size === 0) return;

    const items = [];
    const missing = [];
    for (const id of selectedComments) {
      const sel = bulkSelections[id] || {};
      if (!sel.language || !sel.sentiment) {
        missing.push(id);
        continue;
      }
      items.push({
        commentId: id,
        language: sel.language,
        sentiment: sel.sentiment,
      });
    }

    if (missing.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Missing Selections",
        text: `${missing.length} selected comment(s) are missing language/sentiment.`,
      });
      return;
    }

    setBulkValidating(true);
    try {
      const res = await bulkValidateComments(projectId, items);
      const { successCount, failureCount } = res.data?.data || {};
      await queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["unvalidated-count", projectId] });
      setSelectedComments(new Set());
      setBulkSelections({});
      Swal.fire({
        icon: "success",
        title: `Validated ${successCount} of ${items.length}`,
        text: failureCount > 0 ? `${failureCount} failed` : undefined,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Bulk Validation Failed",
        text: err.response?.data?.error || "Error",
      });
    } finally {
      setBulkValidating(false);
    }
  };

  const toggleCommentSelection = (id) => {
    setSelectedComments((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const selectAllOnPage = () => {
    const newSet = new Set(selectedComments);
    comments.forEach((c) => {
      if (!c.isValidated) newSet.add(c._id);
    });
    setSelectedComments(newSet);
  };

  const clearSelection = () => {
    setSelectedComments(new Set());
    setBulkSelections({});
  };

  /* ---- Edit project ---- */
  const handleEditProject = async (form) => {
    try {
      await updateProject(projectId, form);
      setShowEditProjectModal(false);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      Swal.fire({
        icon: "success",
        title: "Project updated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.response?.data?.error || "Error",
      });
    }
  };

  /* ---- Existing handlers (upload/delete/download) ---- */
  const handleFileUpload = async (file) => {
    setUploading(true);
    sessionStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify({ projectId, uploading: true }));
    try {
      await uploadFileToProject(projectId, file);
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
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      sessionStorage.removeItem(UPLOAD_STATE_KEY);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: err.response?.data?.error || "Error",
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
      confirmButtonText: "Yes, delete!",
    });
    if (!result.isConfirmed) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      Swal.fire({ icon: "success", title: "Deleted!", timer: 1500, showConfirmButton: false })
        .then(() => navigate("/projects"));
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: err.response?.data?.error || "Error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentExportParams = () => {
    const p = {};
    if (!showValidated) p.isValidated = "true"; // when "hide validated" is on, export validated only? No—apply same filter as view
    // Actually mirror current view: only export filtered data
    if (filters.language) p.language = filters.language;
    if (filters.sentiment) p.sentiment = filters.sentiment;
    if (!showValidated) p.isValidated = "false"; // exporting the current view (unvalidated only)
    return p;
  };

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const response = await downloadCommentsCSV(projectId, currentExportParams());
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `project_${project.name.replace(/\s+/g, "_")}_comments.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.response?.data?.error || "Error",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await downloadCommentsExcel(projectId, currentExportParams());
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `project_${project.name.replace(/\s+/g, "_")}_comments.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: err.response?.data?.error || "Error",
      });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const clearFilters = () => {
    setFilters({ language: "", sentiment: "", search: "" });
    setPage(1);
  };

  const pageSizeOptions = [10, 20, 50, 100];

  if (!project && !projectError) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 md:ml-64 p-8 flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 sm:mb-6">
          <div className="w-full lg:w-auto min-w-0">
            <button
              onClick={() => navigate("/projects")}
              className="text-blue-600 hover:text-blue-800 mb-2 text-xs sm:text-sm font-medium flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Projects
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 wrap-break-word">
              {project?.name}
            </h1>
            {project?.description && (
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <Users size={12} className="text-gray-400" />
                {project?.assignedToUsername}
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <FileText size={12} className="text-gray-400" />
                <span className="font-medium">{project?.validatedCount || 0}</span>
                <span className="text-gray-400">/</span>
                <span>{project?.totalComments || 0}</span>
              </span>
              <span className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <Clock size={12} className="text-gray-400" />
                <span className="font-medium text-yellow-600">{unvalidatedCount}</span> pending
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={fileUploaded || uploading}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl transition flex items-center gap-1.5 ${
                  fileUploaded || uploading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {fileUploaded ? "Uploaded" : "Upload File"}
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => setShowAddCommentModal(true)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1.5"
              >
                <MessageSquarePlus size={14} /> Add Comment
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowEditProjectModal(true)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <FolderEdit size={14} /> Edit
              </button>
            )}

            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-slate-600 text-white hover:bg-slate-700 flex items-center gap-1.5"
            >
              <History size={14} /> History
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={handleDownloadCSV}
                  disabled={downloading || comments.length === 0}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel || comments.length === 0}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Download size={14} /> Excel
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-1.5"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
                </button>
              </>
            )}

            <button
              onClick={() => {
                refetchComments();
                refetchUnvalidated();
                refetchProject();
              }}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 pr-2 border-r border-gray-200">
              <Filter size={14} className="text-blue-500" />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Filters</span>
            </div>

            <select
              value={filters.language}
              onChange={(e) => {
                setFilters({ ...filters, language: e.target.value });
                setPage(1);
              }}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm"
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
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm"
            >
              <option value="">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Neutral">Neutral</option>
            </select>

            <div className="flex-1 min-w-40">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters({ ...filters, search: "" })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
            >
              Clear
            </button>

            <button
              onClick={() => setShowValidated(!showValidated)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                showValidated
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200"
              }`}
            >
              {showValidated ? <Eye size={14} /> : <EyeOff size={14} />}
              {showValidated ? "Showing Validated" : "Hiding Validated"}
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {canEdit && selectedComments.size > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-purple-800">
              {selectedComments.size} selected
            </span>
            <button
              onClick={handleBulkValidate}
              disabled={bulkValidating}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 flex items-center gap-1.5"
            >
              {bulkValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Bulk Validate
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-sm font-medium bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Comments table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">No Comments Found</h3>
            <p className="text-gray-500 text-sm mt-2">
              {isAdmin && !fileUploaded
                ? "Upload a file or add a comment manually to get started."
                : "No comments match the current filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {canEdit && (
                      <th className="px-2 py-3 w-8">
                        <button
                          onClick={selectAllOnPage}
                          className="text-gray-400 hover:text-gray-600"
                          title="Select all unvalidated on page"
                        >
                          <CheckSquare size={16} />
                        </button>
                      </th>
                    )}
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Language</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Sentiment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {comments.map((comment, index) => {
                    const isPending = validatingIds.has(comment._id);
                    const isDeletingThis = deletingCommentId === comment._id;
                    const isSelected = selectedComments.has(comment._id);
                    const tempLang = tempSelections[comment._id]?.language || bulkSelections[comment._id]?.language || "";
                    const tempSent = tempSelections[comment._id]?.sentiment || bulkSelections[comment._id]?.sentiment || "";

                    return (
                      <tr
                        key={comment._id}
                        className={`${isSelected ? "bg-purple-50/50" : ""} ${comment.isValidated ? "bg-gray-50/50" : "hover:bg-blue-50/30"}`}
                      >
                        {canEdit && (
                          <td className="px-2 py-3">
                            {!comment.isValidated && (
                              <button
                                onClick={() => toggleCommentSelection(comment._id)}
                                className="text-gray-400 hover:text-purple-600"
                              >
                                {isSelected ? <CheckSquare size={16} className="text-purple-600" /> : <Square size={16} />}
                              </button>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-3 text-xs text-gray-400 font-medium">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-md 
                        
                        wrap-break-word">
                          "{comment.text}"
                          {comment.externalId && (
                            <div className="text-xs text-gray-400 mt-1 font-mono">
                              {comment.externalId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {comment.isValidated ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-md">
                              {comment.language}
                            </span>
                          ) : (
                            <select
                              value={isSelected ? (bulkSelections[comment._id]?.language || "") : tempLang}
                              onChange={(e) => {
                                if (isSelected) {
                                  setBulkSelections((prev) => ({
                                    ...prev,
                                    [comment._id]: { ...prev[comment._id], language: e.target.value },
                                  }));
                                } else {
                                  setTempSelections((prev) => ({
                                    ...prev,
                                    [comment._id]: { ...prev[comment._id], language: e.target.value },
                                  }));
                                }
                              }}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
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
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md ${
                                comment.sentiment === "Positive"
                                  ? "bg-green-50 text-green-700"
                                  : comment.sentiment === "Negative"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-gray-50 text-gray-700"
                              }`}
                            >
                              {comment.sentiment}
                            </span>
                          ) : (
                            <select
                              value={isSelected ? (bulkSelections[comment._id]?.sentiment || "") : tempSent}
                              onChange={(e) => {
                                if (isSelected) {
                                  setBulkSelections((prev) => ({
                                    ...prev,
                                    [comment._id]: { ...prev[comment._id], sentiment: e.target.value },
                                  }));
                                } else {
                                  setTempSelections((prev) => ({
                                    ...prev,
                                    [comment._id]: { ...prev[comment._id], sentiment: e.target.value },
                                  }));
                                }
                              }}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
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
                              <CheckCircle size={13} /> Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">
                              <Clock size={13} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!comment.isValidated && canEdit && !isSelected && (
                              <button
                                onClick={() => handleValidate(comment._id, tempLang, tempSent)}
                                disabled={isPending || !tempLang || !tempSent}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-1"
                              >
                                {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                Save
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => setEditingComment(comment)}
                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                title="Edit comment"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteComment(comment._id)}
                                disabled={isDeletingThis}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                title="Delete comment"
                              >
                                {isDeletingThis ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("open-version-history", {
                                    detail: { entityType: "Comment", entityId: comment._id, entityName: comment.externalId },
                                  })
                                );
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                              title="View history"
                            >
                              <History size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-2.5 py-1 text-sm bg-white"
                >
                  {pageSizeOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-xs sm:text-sm text-gray-600">
                  {pagination.total
                    ? `${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                    : "0"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <span className="text-xs sm:text-sm text-gray-600">
                  Page <span className="font-medium">{page}</span> of{" "}
                  <span className="font-medium">{pagination.totalPages || 1}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
                  disabled={page === pagination.totalPages || !pagination.totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight size={16} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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

      <AddCommentModal
        isOpen={showAddCommentModal}
        onClose={() => setShowAddCommentModal(false)}
        onSubmit={handleAddComment}
        isLoading={false}
      />

      <EditCommentModal
        isOpen={!!editingComment}
        onClose={() => setEditingComment(null)}
        comment={editingComment}
        onSubmit={handleEditComment}
        isLoading={false}
      />

      <EditProjectModal
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        project={project}
        users={users}
        onSubmit={handleEditProject}
        isLoading={false}
      />

      <VersionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        entityType="Project"
        entityId={projectId}
        entityName={project?.name}
        onReverted={() => {
          queryClient.invalidateQueries({ queryKey: ["project", projectId] });
          queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
        }}
      />
    </div>
  );
}

export default ProjectDetail;