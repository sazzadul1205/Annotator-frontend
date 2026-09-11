import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { tokenStore } from "../services/api";
import {
  getMe,
  login as loginApi,
  logout as logoutApi,
} from "../services/authApi";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  useEffect(() => {
    const token = tokenStore.get();

    if (!token) {
      return;
    }

    getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    const res = await loginApi({ email, password });

    tokenStore.set(res.token);
    setUser(res.user);

    return res.user;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout API errors
    }

    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}