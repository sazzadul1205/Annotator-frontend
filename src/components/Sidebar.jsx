import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Sidebar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="w-64 bg-gray-800 text-white h-screen fixed left-0 top-0 p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Annotator</h2>
        <p className="text-sm text-gray-400">{user?.username || 'User'}</p>
        <p className="text-xs text-gray-500">{user?.role || 'Role'}</p>
      </div>

      <nav className="space-y-2">
        <Link 
          to="/dashboard" 
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          Dashboard
        </Link>
        <Link 
          to="/projects" 
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          Projects
        </Link>
        {user?.role === 'Admin' && (
          <Link 
            to="/users" 
            className="block px-4 py-2 rounded hover:bg-gray-700 transition"
          >
            User Management
          </Link>
        )}
        <Link 
          to="/profile" 
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          Profile
        </Link>
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default Sidebar