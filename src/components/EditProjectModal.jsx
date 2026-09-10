import { useState } from "react";
import { X, Save, AlertCircle, Loader2, FolderEdit } from "lucide-react";

const EditProjectModal = ({ isOpen, onClose, project, users, onSubmit, isLoading }) => {
  const [form, setForm] = useState({
    name: project?.name || "",
    description: project?.description || "",
    assignedTo: project?.assignedTo?.toString() || "",
    status: project?.status || "pending",
  });
  const [error, setError] = useState("");

  if (!isOpen || !project) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Project name is required");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-50 rounded-xl">
              <FolderEdit size={18} className="sm:text-[22px] text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Edit Project
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Update project information
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Assigned To
            </label>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={isLoading}
            >
              {(users || [])
                .filter((u) => u.role === "Annotator" || u.role === "Viewer")
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.username} ({u.role})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={isLoading}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;