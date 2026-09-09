// src/context/AuthProvider.jsx
import { useState } from 'react';
import { AuthContext } from './context';
import { loginUser } from '../services/api';
import { getInitialUser } from '../utils/authHelpers';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);

  const login = async (username, password) => {
    try {
      const response = await loginUser(username, password);
      const { user, token } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
      return { success: true, data: user };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};