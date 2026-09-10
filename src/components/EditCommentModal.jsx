import { useState } from "react";
import { X, Save, AlertCircle, Loader2 } from "lucide-react";

const EditCommentModal = ({ isOpen, onClose, comment, onSubmit, isLoading }) => {
  // Initialize directly from props.
  // Parent passes key={comment._id}, so this component remounts
  // whenever a different comment is opened — no useEffect needed.
  const [text, setText] = useState(comment?.text || "");
  const [error, setError] = useState("");

  if (!isOpen || !comment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!text.trim()) {
      setError("Comment text cannot be empty");
      return;
    }
    onSubmit(text.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Edit Comment
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              External ID: {comment.externalId || "N/A"}
            </p>
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
              Comment Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows="5"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isLoading}
              required
            />
          </div>

          <p className="text-xs text-gray-400">
            Every edit is recorded in the change history and can be reverted by an Admin.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
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
              disabled={isLoading || text.trim() === (comment.text || "").trim()}
              className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm shadow-sm hover:shadow-md"
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

export default EditCommentModal;