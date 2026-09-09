import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  LayoutDashboard, 
  FolderOpen, 
  Users, 
  UserCircle, 
  LogOut,
  Shield,
  ChevronRight,
} from 'lucide-react'

const Sidebar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Improved active state detection for nested routes
  const isActive = (path) => {
    const currentPath = location.pathname
    
    // If it's the dashboard, match exactly or /dashboard/*
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath.startsWith('/dashboard/')
    }
    
    // For other routes, check if the current path starts with the route path
    // and ensure it's a proper sub-path (not partial match)
    if (currentPath.startsWith(path)) {
      // Check if the next character is '/' or end of string
      const nextChar = currentPath.charAt(path.length)
      return nextChar === '/' || nextChar === ''
    }
    
    return false
  }

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
    },
    { 
      path: '/projects', 
      label: 'Projects', 
      icon: FolderOpen,
    },
    ...(user?.role === 'Admin' ? [{ 
      path: '/users', 
      label: 'User Management', 
      icon: Users 
    }] : []),
    { 
      path: '/profile', 
      label: 'Profile', 
      icon: UserCircle,
    },
  ]

  return (
    <div className="w-64 bg-linear-to-b from-gray-900 to-gray-800 text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl">
      {/* Brand Section */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Annotator
            </h2>
            <p className="text-xs text-gray-400">Annotation Platform</p>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  user?.role === 'Admin' 
                    ? 'bg-purple-500/20 text-purple-300' 
                    : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {user?.role || 'Role'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-linear-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 transition-colors ${
                  active ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-200'
                }`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {active && (
                <ChevronRight className="w-4 h-4 text-blue-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-700/50">
        <button
          onClick={handleLogout}
          className="w-full group flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 border border-red-500/20 hover:border-red-500/40"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar