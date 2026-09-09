import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default AdminRoute