import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login, logout, register, getStoredSession } from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (session.access && session.role) {
      setAccessToken(session.access);
      setUser({ username: session.username, role: session.role });
    }
    setLoading(false);
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    loading,
    async login(username, password) {
      const data = await login(username, password);
      setAccessToken(data.access);
      setUser({ username: data.username, role: data.role });
      return data;
    },
    async register(username, password, role) {
      return register(username, password, role);
    },
    logout() {
      logout();
      setAccessToken(null);
      setUser(null);
    },
  }), [user, accessToken, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
