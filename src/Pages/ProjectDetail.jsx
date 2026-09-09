import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProject,
  getComments,
  uploadFileToProject,
  validateComment,
  getUnvalidatedCount,
} from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
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
} from "lucide-react";

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

  // Temporary selections for language and sentiment per comment
  const [tempSelections, setTempSelections] = useState({});

  // Fetch project details
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

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
    refetch,
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

  // Validate single comment mutation
  const validateMutation = useMutation({
    mutationFn: ({ commentId, data }) => validateComment(commentId, data),
    onSuccess: () => {
      // Invalidate all queries that depend on project data
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["unvalidated-count", projectId],
      });
      // Optionally refetch immediately
      refetch();
      refetchUnvalidated();
    },
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ projectId, file }) => uploadFileToProject(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["unvalidated-count", projectId],
      });
      refetch();
      refetchUnvalidated();
      setUploading(false);
    },
    onError: (err) => {
      alert("Upload failed: " + (err.response?.data?.error || "Unknown error"));
      setUploading(false);
    },
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a CSV or Excel file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }
    setUploading(true);
    uploadMutation.mutate({ projectId, file });
  };

  const handleValidate = (commentId, language, sentiment) => {
    if (!language || !sentiment) {
      alert("Please select both language and sentiment");
      return;
    }
    validateMutation.mutate({ commentId, data: { language, sentiment } });
  };

  const clearFilters = () => {
    setFilters({ language: "", sentiment: "", search: "" });
    setPage(1);
  };

  const canValidate = user?.role !== "Viewer";
  const isAdmin = user?.role === "Admin";

  const pageSizeOptions = [10, 20, 50, 100];

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <button
              onClick={() => navigate("/projects")}
              className="text-blue-600 hover:text-blue-800 transition flex items-center gap-1 mb-2"
            >
              <ArrowLeft size={20} />
              Back to Projects
            </button>
            <h1 className="text-3xl font-bold text-gray-800">
              {project?.name}
            </h1>
            <p className="text-gray-600">{project?.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1 text-gray-500">
                <Users size={14} />
                Assigned to:{" "}
                <span className="font-medium">
                  {project?.assignedToUsername}
                </span>
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <FileText size={14} />
                Progress: {project?.validatedCount || 0} /{" "}
                {project?.totalComments || 0}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Clock size={14} />
                Pending: {unvalidatedCount}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <label className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2 cursor-pointer">
                <Upload size={20} />
                {uploading ? "Uploading..." : "Upload File"}
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
            <button
              onClick={() => refetch()}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <select
              value={filters.language}
              onChange={(e) => {
                setFilters({ ...filters, language: e.target.value });
                setPage(1);
              }}
              className="px-3 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-3 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Neutral">Neutral</option>
            </select>

            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={clearFilters}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Clear All
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowValidated(!showValidated)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm transition ${
                  showValidated
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {showValidated ? <Eye size={16} /> : <EyeOff size={16} />}
                {showValidated ? "Hide Validated" : "Show Validated"}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">
              No Comments Found
            </h3>
            <p className="text-gray-500 mt-2">
              {isAdmin
                ? "Upload a file to get started."
                : "No comments available for this project."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Language
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                      Sentiment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comments.map((comment, index) => {
                    const isPending =
                      validateMutation.isPending &&
                      validateMutation.variables?.commentId === comment._id;
                    const isDisabled =
                      comment.isValidated || !canValidate || isPending;

                    // Get temp selections for this comment
                    const tempLang =
                      tempSelections[comment._id]?.language || "";
                    const tempSent =
                      tempSelections[comment._id]?.sentiment || "";

                    return (
                      <tr
                        key={comment._id}
                        className={`${
                          comment.isValidated
                            ? "bg-gray-50 opacity-75"
                            : "hover:bg-gray-50"
                        } transition`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 wrap-break-word max-w-md">
                          {comment.text}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
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
                              className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDisabled
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
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
                              className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isDisabled
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
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
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
                              <CheckCircle size={14} />
                              Validated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
                              <Clock size={14} />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!comment.isValidated && canValidate ? (
                            <button
                              onClick={() => {
                                const lang = tempLang;
                                const sent = tempSent;
                                handleValidate(comment._id, lang, sent);
                              }}
                              disabled={isPending}
                              className={`px-3 py-1 text-sm rounded-lg transition ${
                                isPending
                                  ? "bg-gray-300 cursor-not-allowed"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              }`}
                            >
                              {isPending ? "..." : "Validate"}
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
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="ml-2">
                  {pagination.total
                    ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, pagination.total)} of ${pagination.total}`
                    : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages || 1, p + 1))
                  }
                  disabled={
                    page === pagination.totalPages ||
                    pagination.totalPages === 0
                  }
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
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
