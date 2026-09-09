import { X, UserPlus, Edit, AlertCircle } from 'lucide-react';
import UserForm from './UserForm';

const UserModal = ({
  isOpen,
  mode = 'create',
  initialData = null,
  onSubmit,
  onClose,
  isLoading,
  error,
  setError,
}) => {
  if (!isOpen) return null;

  const isEditMode = mode === 'edit';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-xl ${isEditMode ? 'bg-blue-50' : 'bg-blue-50'} shrink-0`}>
              {isEditMode ? (
                <Edit size={18} className="sm:text-[22px] text-blue-600" />
              ) : (
                <UserPlus size={18} className="sm:text-[22px] text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {isEditMode ? 'Edit User' : 'Create Annotator'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {isEditMode ? 'Update user information' : 'Add a new user to the system'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 shrink-0"
            disabled={isLoading}
          >
            <X size={18} className="sm:text-[20px] text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          {error && (
            <div className="mb-4 sm:mb-6 p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
              <AlertCircle size={16} className="sm:text-[18px] mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <UserForm
            mode={mode}
            initialData={initialData}
            onSubmit={onSubmit}
            onCancel={onClose}
            isLoading={isLoading}
            error={error}
            setError={setError}
          />
        </div>
      </div>
    </div>
  );
};

export default UserModal;