import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'

function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-gray-600 mt-2">You are logged in as {user?.role}</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard