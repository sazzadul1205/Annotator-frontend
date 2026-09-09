import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateAccount, changePassword } from '../services/api'
import Sidebar from '../components/Sidebar'
import {
  User,
  Mail,
  Shield,
  Calendar,
  Edit,
  Lock,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Key,
  UserCircle,
  Settings,
} from 'lucide-react'

function Profile() {
  const { user } = useAuth()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [editData, setEditData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleProfileUpdate = async (e) => {
    e.preventDefault()

    if (!editData.username || !editData.email) {
      setError('All fields are required')
      setTimeout(() => setError(''), 3000)
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      await updateAccount(user?._id, editData)

      const updatedUser = { ...user, ...editData }
      localStorage.setItem('user', JSON.stringify(updatedUser))

      setSuccess('Profile updated successfully!')
      setIsEditing(false)
      setTimeout(() => setSuccess(''), 3000)

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      setTimeout(() => setError(''), 3000)
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      await changePassword(user?._id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      setSuccess('Password changed successfully!')
      setIsChangingPassword(false)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setTimeout(() => setSuccess(''), 3000)

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password')
      setTimeout(() => setError(''), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-4 sm:p-6 md:p-8 w-full">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <UserCircle size={24} className="sm:text-[32px] text-blue-500" />
              Profile
            </h1>
            {!isEditing && !isChangingPassword && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Edit size={16} className="sm:text-[20px]" />
                Edit Profile
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-2.5 sm:p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} className="sm:text-[20px]" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-2.5 sm:p-3 bg-green-100 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="sm:text-[20px]" />
              {success}
            </div>
          )}

          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-4 sm:mb-6 pb-4 border-b">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <User size={32} className="sm:text-[40px] text-blue-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold wrap-break-word">{user?.username}</h2>
                <p className="text-gray-600 text-sm sm:text-base break-all">{user?.email}</p>
                <span className="inline-flex items-center gap-1 px-2 py-1 mt-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  <Shield size={12} />
                  {user?.role}
                </span>
              </div>
            </div>

            {!isEditing && !isChangingPassword ? (
              /* View Mode */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <User size={16} className="sm:text-[20px] text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500">Username</p>
                    <p className="font-medium text-sm sm:text-base truncate">{user?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <Mail size={16} className="sm:text-[20px] text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500">Email</p>
                    <p className="font-medium text-sm sm:text-base truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <Shield size={16} className="sm:text-[20px] text-gray-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Role</p>
                    <p className="font-medium text-sm sm:text-base">{user?.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <Calendar size={16} className="sm:text-[20px] text-gray-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Member Since</p>
                    <p className="font-medium text-sm sm:text-base">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <Key size={16} className="sm:text-[20px] text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500">UID</p>
                    <p className="font-medium text-xs truncate">{user?.uid}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <Settings size={16} className="sm:text-[20px] text-gray-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Status</p>
                    <p className="font-medium text-xs sm:text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle size={12} className="sm:text-[14px]" />
                      Active
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Edit Profile Mode */}
            {isEditing && (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 items-center gap-2">
                      <User size={16} />
                      Username
                    </label>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) =>
                        setEditData({ ...editData, username: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 items-center gap-2">
                      <Mail size={16} />
                      Email
                    </label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) =>
                        setEditData({ ...editData, email: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setEditData({
                        username: user?.username || '',
                        email: user?.email || '',
                      })
                      setError('')
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300 flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <Save size={16} />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Password Change Section */}
            {!isEditing && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                {!isChangingPassword ? (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="text-blue-600 hover:text-blue-800 transition flex items-center gap-2 text-sm sm:text-base"
                  >
                    <Key size={16} className="sm:text-[18px]" />
                    Change Password
                  </button>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2 text-base sm:text-lg">
                      <Lock size={16} className="sm:text-[18px]" />
                      Change Password
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              currentPassword: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              newPassword: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false)
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: '',
                          })
                          setError('')
                        }}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:bg-green-300 flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <CheckCircle size={16} />
                        {isLoading ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile