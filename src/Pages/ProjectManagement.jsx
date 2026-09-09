import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  getProjects, 
  deleteProject, 
  getUsers 
} from '../services/api'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import CreateProjectModal from '../components/CreateProjectModal'
import {
  FolderOpen,
  Plus,
  Trash2,
  Eye,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react'

function ProjectManagement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Fetch projects
  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  // Fetch users for assignment (only if admin)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: user?.role === 'Admin',
  })

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: (projectId) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects'])
    },
    onError: (err) => {
      alert('Failed to delete project: ' + (err.response?.data?.error || 'Unknown error'))
    },
  })

  const handleDelete = (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate(projectId)
    }
  }

  const projects = data?.data?.data || []
  const users = usersData?.data?.data || []

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: FileText, label: 'In Progress' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
    }
    const s = statusMap[status] || statusMap.pending
    const Icon = s.icon
    return (
      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${s.color}`}>
        <Icon size={12} />
        {s.label}
      </span>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen size={32} className="text-blue-500" />
            Projects
          </h1>
          {user?.role === 'Admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
            >
              <Plus size={20} />
              Create Project
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            Failed to load projects.
          </div>
        )}

        {!isLoading && !isError && projects.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FolderOpen size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">No Projects Yet</h3>
            <p className="text-gray-500 mt-2">
              {user?.role === 'Admin' 
                ? 'Create your first project to get started.' 
                : 'You have no projects assigned to you yet.'}
            </p>
            {user?.role === 'Admin' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Create Project
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {project.name}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {project.description || 'No description'}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Users size={14} />
                        Assigned to:
                      </span>
                      <span className="font-medium">{project.assignedToUsername}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1">
                        <FileText size={14} />
                        Progress:
                      </span>
                      <span className="font-medium">
                        {project.validatedCount || 0} / {project.totalComments || 0}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-500 rounded-full h-2 transition-all"
                        style={{
                          width: project.totalComments > 0 
                            ? `${(project.validatedCount || 0) / project.totalComments * 100}%` 
                            : '0%'
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/projects/${project._id}`)
                      }}
                      className="text-blue-600 hover:text-blue-800 transition p-1 hover:bg-blue-50 rounded"
                      title="View Project"
                    >
                      <Eye size={18} />
                    </button>
                    {user?.role === 'Admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(project._id)
                        }}
                        disabled={deleteMutation.isPending}
                        className={`text-red-600 hover:text-red-800 transition p-1 rounded ${
                          deleteMutation.isPending
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-red-50'
                        }`}
                        title="Delete Project"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <CreateProjectModal
            onClose={() => setShowCreateModal(false)}
            users={users}
          />
        )}
      </div>
    </div>
  )
}

export default ProjectManagement