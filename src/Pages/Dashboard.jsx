import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'

function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 p-8 w-full">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Welcome, {user?.username}!
          </h1>
          <p className="text-gray-600">You are logged in as {user?.role}</p>
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold">Your Info:</h3>
            <p>Username: {user?.username}</p>
            <p>Email: {user?.email}</p>
            <p>UID: {user?.uid}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard