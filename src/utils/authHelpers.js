export const getInitialUser = () => {
  try {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      return JSON.parse(userData)
    }
    return null
  } catch {
    return null
  }
}