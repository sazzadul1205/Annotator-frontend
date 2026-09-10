import { useState, useEffect } from "react";
import { X, History, RotateCcw, Loader2, User, ChevronDown, ChevronRight } from "lucide-react";
import { getVersionHistory, getVersionSnapshot, revertToVersion } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import Swal from "sweetalert2";

const ACTION_COLORS = {
  create: "bg-green-50 text-green-700 border-green-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  validate: "bg-purple-50 text-purple-700 border-purple-200",
  revert: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const VersionHistoryModal = ({ isOpen, onClose, entityType, entityId, entityName, onReverted }) => {
  const { user } = useAuth();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!isOpen || !entityId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const res = await getVersionHistory(entityType, entityId, { limit: 100 });
        setVersions(res.data?.data?.versions || []);
      } catch (err) {
        console.error("History fetch error:", err);
        Swal.fire({
          icon: "error",
          title: "Failed to Load History",
          text: err.response?.data?.error || "Could not load version history",
        });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [isOpen, entityType, entityId]);

  const handleRevert = async (version) => {
    const confirm = await Swal.fire({
      title: `Revert to version ${version}?`,
      text: "The current state will be replaced by this earlier version. This action itself is logged.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#F59E0B",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, revert",
    });
    if (!confirm.isConfirmed) return;

    setReverting(true);
    try {
      await revertToVersion(entityType, entityId, version);
      Swal.fire({
        icon: "success",
        title: "Reverted!",
        timer: 1500,
        showConfirmButton: false,
      });
      onReverted?.();
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Revert Failed",
        text: err.response?.data?.error || err.message || "Failed to revert",
      });
    } finally {
      setReverting(false);
    }
  };

  const handleToggleSnapshot = async (version) => {
    if (expanded === version) {
      setExpanded(null);
      return;
    }
    if (!versions.find((v) => v.version === version)?.after) {
      try {
        const res = await getVersionSnapshot(entityType, entityId, version);
        const snap = res.data?.data;
        setVersions((prev) =>
          prev.map((v) =>
            v.version === version ? { ...v, after: snap?.after, before: snap?.before } : v
          )
        );
      } catch (err) {
        console.error("Snapshot fetch error:", err);
      }
    }
    setExpanded(version);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-xl shrink-0">
              <History size={18} className="sm:text-[22px] text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Version History
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {entityType}: {entityName || entityId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
          >
            <X size={18} className="sm:text-[20px] text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No version history yet</p>
            </div>
          ) : (
            <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
              {versions.map((v) => (
                <li key={v._id} className="ml-4 sm:ml-6 relative">
                  <span className="absolute -left-6 sm:-left-8 flex items-center justify-center w-4 h-4 bg-white border-2 border-indigo-400 rounded-full" />
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full border ${ACTION_COLORS[v.action] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                            {v.action}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700">
                            v{v.version}
                          </span>
                          {v.username && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User size={11} /> {v.username}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(v.createdAt).toLocaleString()}
                        </p>
                        {v.changedFields?.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Changed:{" "}
                            <span className="font-mono text-gray-700">
                              {v.changedFields.join(", ")}
                            </span>
                          </p>
                        )}
                        {v.metadata && Object.keys(v.metadata).length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {Object.entries(v.metadata)
                              .map(([k, val]) => `${k}: ${val}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleSnapshot(v.version)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="View snapshot"
                        >
                          {expanded === v.version ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        {user?.role === "Admin" && v.version > 1 && v.action !== "create" && (
                          <button
                            onClick={() => handleRevert(v.version)}
                            disabled={reverting}
                            className="p-1.5 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-lg transition disabled:opacity-50"
                            title={`Revert to v${v.version}`}
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded === v.version && v.after && (
                      <pre className="mt-3 p-2 bg-white rounded border border-gray-200 text-[10px] sm:text-xs overflow-x-auto max-h-60">
                        {JSON.stringify(v.after, null, 2)}
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;