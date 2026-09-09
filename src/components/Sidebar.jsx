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
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const Sidebar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
    setIsMobileOpen(false)
  }

  const isActive = (path) => {
    const currentPath = location.pathname
    
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath.startsWith('/dashboard/')
    }
    
    if (currentPath.startsWith(path)) {
      const nextChar = currentPath.charAt(path.length)
      return nextChar === '/' || nextChar === ''
    }
    
    return false
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/projects', label: 'Projects', icon: FolderOpen },
    ...(user?.role === 'Admin' ? [{ path: '/users', label: 'User Management', icon: Users }] : []),
    { path: '/profile', label: 'Profile', icon: UserCircle },
  ]

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Brand Section */}
      <div className="p-4 sm:p-6 border-b border-gray-700/50">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
              Annotator
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-400 truncate">Annotation Platform</p>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg shrink-0">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">{user?.username || 'User'}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full truncate ${
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
      <nav className="flex-1 p-2 sm:p-4 space-y-0.5 sm:space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={`group flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-linear-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg shadow-blue-500/10'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-colors ${
                  active ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-200'
                }`} />
                <span className="text-xs sm:text-sm font-medium truncate">{item.label}</span>
              </div>
              {active && (
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 sm:p-4 border-t border-gray-700/50">
        <button
          onClick={handleLogout}
          className="w-full group flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-200 border border-red-500/20 hover:border-red-500/40 text-sm"
        >
          <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-1" />
          <span className="text-xs sm:text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden bg-gray-900 text-white p-2 rounded-lg shadow-lg"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full w-64 bg-linear-to-b from-gray-900 to-gray-800 text-white shadow-2xl z-50
          transition-transform duration-300 ease-in-out
          ${isMobile ? (isMobileOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        {sidebarContent}
      </div>
    </>
  )
}

export default Sidebar