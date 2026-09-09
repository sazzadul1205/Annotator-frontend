import { useState } from 'react'
import { X, FolderPlus, Users, AlertCircle, User, FileText } from 'lucide-react'

import { createProject } from '../services/api'

function CreateProjectModal({ onClose, users, onProjectCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assignedTo: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.assignedTo) {
      setError('Project name and assigned user are required')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await createProject(formData)
      if (response?.data?.success) {
        onProjectCreated?.()
        onClose()
      } else {
        setError(response?.data?.error || 'Failed to create project')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-blue-50 rounded-xl shrink-0">
              <FolderPlus size={18} className="sm:text-[22px] text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Create Project</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Add a new annotation project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors duration-200 shrink-0"
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

          <form onSubmit={handleSubmit}>
            {/* Project Name */}
            <div className="mb-4 sm:mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText size={16} className="sm:text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter project name"
                  className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-4 sm:mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the project..."
                className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                rows="3"
              />
            </div>

            {/* Assign To */}
            <div className="mb-5 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <Users size={14} className="sm:text-[16px] text-gray-500" />
                  Assign To <span className="text-red-500">*</span>
                </span>
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) =>
                  setFormData({ ...formData, assignedTo: e.target.value })
                }
                className="w-full px-3 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                required
              >
                <option value="">Select a user...</option>
                {users
                  .filter(u => u.role === 'Annotator' || u.role === 'Viewer')
                  .map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
              </select>
              <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                <User size={12} />
                <span className="truncate">Only Annotators and Viewers can be assigned</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm sm:text-base shadow-sm hover:shadow-md"
              >
                <FolderPlus size={16} className="sm:text-[18px]" />
                {isLoading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateProjectModal