import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProject } from '../services/api'
import { X, FolderPlus, Users, AlertCircle } from 'lucide-react'

function CreateProjectModal({ onClose, users }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assignedTo: '',
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects'])
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to create project')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name || !formData.assignedTo) {
      setError('Project name and assigned user are required')
      return
    }
    createMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderPlus size={24} className="text-blue-500" />
            Create Project
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition p-1 hover:bg-gray-100 rounded"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 items-center gap-1">
              <Users size={16} />
              Assign To *
            </label>
            <select
              value={formData.assignedTo}
              onChange={(e) =>
                setFormData({ ...formData, assignedTo: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300 flex items-center gap-2"
            >
              <FolderPlus size={16} />
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateProjectModal