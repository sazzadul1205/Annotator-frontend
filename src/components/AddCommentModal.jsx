import { useState } from "react";
import { X, MessageSquarePlus, AlertCircle, Loader2 } from "lucide-react";

const LANGUAGES = ["Bangla", "English", "Banglish", "Emoji", "Other"];
const SENTIMENTS = ["Positive", "Negative", "Neutral"];

const AddCommentModal = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [form, setForm] = useState({
    text: "",
    externalId: "",
    language: "",
    sentiment: "",
  });
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!form.text.trim()) {
      setError("Comment text is required");
      return;
    }
    // If one of language/sentiment is given, both must be given
    if ((form.language && !form.sentiment) || (!form.language && form.sentiment)) {
      setError("Select both language and sentiment, or neither");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-50 rounded-xl">
              <MessageSquarePlus size={18} className="sm:text-[22px] text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Add Comment
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Manually add a comment to this project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <X size={18} className="sm:text-[20px] text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Comment Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Enter comment text..."
              rows="4"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              External ID <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={form.externalId}
              onChange={(e) => setForm({ ...form, externalId: e.target.value })}
              placeholder="e.g. comment_001"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Language
              </label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                disabled={isLoading}
              >
                <option value="">(skip)</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sentiment
              </label>
              <select
                value={form.sentiment}
                onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                disabled={isLoading}
              >
                <option value="">(skip)</option>
                {SENTIMENTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Leave language & sentiment blank to add as unvalidated. Both must be set to mark as validated.
          </p>

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
              className="w-full sm:flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Adding...</>
              ) : (
                <><MessageSquarePlus size={16} /> Add Comment</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCommentModal;