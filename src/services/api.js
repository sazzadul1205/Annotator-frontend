import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

export const loginUser = (username, password) => {
  return axios.post(`${API_URL}/auth/login`, {
    username,
    password,
  })
}

export const createAccount = (userData) => {
  return axios.post(`${API_URL}/auth/create-account`, userData)
}

export const getUser = (userId) => {
  const token = localStorage.getItem('token')

  return axios.get(`${API_URL}/auth/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const updateAccount = (userId, data) => {
  const token = localStorage.getItem('token')

  return axios.put(
    `${API_URL}/auth/update-account/${userId}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
}

export const changePassword = (userId, data) => {
  const token = localStorage.getItem('token')

  return axios.put(
    `${API_URL}/auth/change-password/${userId}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
}

export const deleteAccount = (userId) => {
  const token = localStorage.getItem('token')

  return axios.delete(
    `${API_URL}/auth/delete-account/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
}