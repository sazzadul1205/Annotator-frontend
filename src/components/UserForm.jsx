import { useState } from 'react';
import { User, Mail, Lock, Shield, CheckCircle, UserPlus } from 'lucide-react';
import { generatePassword } from '../utils/passwordGenerator';

const UserForm = ({
  mode = 'create',
  initialData = null,
  onSubmit,
  onCancel,
  isLoading,
  error,
  setError
}) => {
  const [formData, setFormData] = useState(
    mode === 'create'
      ? {
        username: '',
        email: '',
        password: '',
        role: 'Annotator',
      }
      : {
        _id: initialData?._id || '',
        username: initialData?.username || '',
        email: initialData?.email || '',
        password: '',
        role: initialData?.role || 'Annotator',
      }
  );

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(14);
    setFormData((prev) => ({ ...prev, password: newPassword }));
    setShowPassword(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isEditMode = mode === 'edit';

  return (
    <form onSubmit={handleSubmit}>
      {/* Username */}
      <div className="mb-3 sm:mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <User size={14} className="sm:text-[16px] text-gray-400" />
            Username <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Enter username"
          className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          required
          disabled={isLoading}
        />
      </div>

      {/* Email */}
      <div className="mb-3 sm:mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <Mail size={14} className="sm:text-[16px] text-gray-400" />
            Email <span className="text-red-500">*</span>
          </span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter email address"
          autoComplete="username"
          className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          required
          disabled={isLoading}
        />
      </div>

      {/* Password */}
      <div className="mb-3 sm:mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <Lock size={14} className="sm:text-[16px] text-gray-400" />
            {isEditMode ? 'New Password' : 'Password'}
            {!isEditMode && <span className="text-red-500">*</span>}
            {isEditMode && <span className="text-gray-400 text-xs">(optional)</span>}
          </span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={
              isEditMode
                ? 'Leave blank to keep current'
                : 'Enter password (min 6 characters)'
            }
            autoComplete="new-password"
            className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-20 sm:pr-24"
            required={!isEditMode}
            minLength={isEditMode ? undefined : 6}
            disabled={isLoading}
          />
          <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              disabled={isLoading}
            >
              {showPassword ? (
                <Lock size={14} className="sm:text-[16px] text-blue-500" />
              ) : (
                <Lock size={14} className="sm:text-[16px]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleGeneratePassword}
              className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition whitespace-nowrap flex items-center gap-0.5 sm:gap-1"
              disabled={isLoading}
            >
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Generate</span>
              <span className="sm:hidden">Gen</span>
            </button>
          </div>
        </div>
        {!isEditMode && (
          <p className="mt-1 text-xs text-gray-400">Minimum 6 characters</p>
        )}
      </div>

      {/* Role */}
      <div className="mb-4 sm:mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <Shield size={14} className="sm:text-[16px] text-gray-400" />
            Role
          </span>
        </label>
        {isEditMode ? (
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
            disabled={isLoading}
          >
            <option value="Annotator">Annotator</option>
            <option value="Admin">Admin</option>
          </select>
        ) : (
          <div className="relative">
            <input
              type="text"
              value="Annotator"
              disabled
              className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle size={14} className="sm:text-[16px] text-blue-500" />
            </div>
          </div>
        )}
        {!isEditMode && (
          <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
            <User size={12} />
            All new users are created as Annotators
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium text-sm sm:text-base disabled:opacity-50"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm sm:text-base shadow-sm hover:shadow-md"
        >
          {isEditMode ? (
            <>
              <CheckCircle size={16} className="sm:text-[18px]" />
              {isLoading ? 'Updating...' : 'Update User'}
            </>
          ) : (
            <>
              <UserPlus size={16} className="sm:text-[18px]" />
              {isLoading ? 'Creating...' : 'Create Annotator'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UserForm;