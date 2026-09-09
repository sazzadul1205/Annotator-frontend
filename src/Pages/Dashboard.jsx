import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'

function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full min-h-screen">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 wrap-break-word">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            You are logged in as <span className="font-medium">{user?.role}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard