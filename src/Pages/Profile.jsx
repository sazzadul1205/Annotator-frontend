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
  Eye,
  EyeOff,
} from 'lucide-react'

function Profile() {
  const { user } = useAuth()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U'
    return name.charAt(0).toUpperCase()
  }

  // Get role color
  const getRoleColor = (role) => {
    return role === 'Admin' 
      ? 'bg-purple-100 text-purple-800 border-purple-200' 
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-3 sm:p-4 md:p-8 w-full min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
                <UserCircle size={24} className="sm:text-[32px] text-blue-500" />
                Profile
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Manage your account settings and preferences
              </p>
            </div>
            {!isEditing && !isChangingPassword && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <Edit size={16} className="sm:text-[18px]" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={18} className="sm:text-[20px] shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-start gap-3 text-sm">
              <CheckCircle size={18} className="sm:text-[20px] shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Profile Header */}
            <div className="p-5 sm:p-7 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <span className="text-2xl sm:text-3xl font-bold text-white">
                      {getInitials(user?.username)}
                    </span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-medium border-2 border-white ${getRoleColor(user?.role)}`}>
                    {user?.role}
                  </div>
                </div>

                {/* User Info */}
                <div className="text-center sm:text-left flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 wrap-break-words">
                    {user?.username}
                  </h2>
                  <p className="text-gray-500 text-sm sm:text-base break-all">{user?.email}</p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded-full border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      Active
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-full border border-gray-200">
                      <Calendar size={12} />
                      Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="p-5 sm:p-7">
              {!isEditing && !isChangingPassword ? (
                /* View Mode - Profile Details */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User size={16} className="sm:text-[18px] text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Username</p>
                        <p className="font-medium text-sm sm:text-base truncate">{user?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Mail size={16} className="sm:text-[18px] text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Email</p>
                        <p className="font-medium text-sm sm:text-base truncate">{user?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Shield size={16} className="sm:text-[18px] text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Role</p>
                        <p className="font-medium text-sm sm:text-base">{user?.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Calendar size={16} className="sm:text-[18px] text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member Since</p>
                        <p className="font-medium text-sm sm:text-base">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors sm:col-span-2">
                      <div className="p-2 bg-gray-200 rounded-lg">
                        <Key size={16} className="sm:text-[18px] text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">User ID</p>
                        <p className="font-mono text-xs sm:text-sm truncate">{user?.uid || user?._id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Change Password Button */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base transition-colors hover:bg-blue-50 px-4 py-2 rounded-xl"
                    >
                      <Key size={16} className="sm:text-[18px]" />
                      Change Password
                    </button>
                  </div>
                </>
              ) : null}

              {/* Edit Profile Mode */}
              {isEditing && (
                <form onSubmit={handleProfileUpdate} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <span className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          Username <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={editData.username}
                        onChange={(e) =>
                          setEditData({ ...editData, username: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <span className="flex items-center gap-2">
                          <Mail size={16} className="text-gray-400" />
                          Email <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="email"
                        value={editData.email}
                        onChange={(e) =>
                          setEditData({ ...editData, email: e.target.value })
                        }
                        className="w-full px-4 py-2.5 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
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
                      className="w-full sm:w-auto px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base font-medium"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Save size={16} />
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

              {/* Password Change Section */}
              {!isEditing && isChangingPassword && (
                <div className="mt-0">
                  <form onSubmit={handlePasswordChange} className="space-y-5">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                      <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-gray-800">
                        <Lock size={18} className="text-blue-500" />
                        Change Password
                      </h3>
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
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Current Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Current Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) =>
                              setPasswordData({
                                ...passwordData,
                                currentPassword: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 pr-12 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            New Password <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  newPassword: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 pr-12 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                              required
                              minLength={6}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-gray-400">Minimum 6 characters</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Confirm Password <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 pr-12 text-sm sm:text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          {passwordData.newPassword && passwordData.confirmPassword && (
                            <p className={`mt-1.5 text-xs ${passwordData.newPassword === passwordData.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                              {passwordData.newPassword === passwordData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
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
                        className="w-full sm:w-auto px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base font-medium"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 disabled:bg-green-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.98]"
                      >
                        <CheckCircle size={16} />
                        {isLoading ? 'Changing...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile