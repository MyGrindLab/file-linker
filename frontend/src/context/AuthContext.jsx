import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { refreshToken } from '../services/api';

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('token');
    return t ? decodeToken(t) : null;
  });

  const login = useCallback((newToken) => {
    const payload = decodeToken(newToken);
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const res = await refreshToken();
    if (!res || !res.ok) return false;
    const data = await res.json();
    login(data.access_token);
    return true;
  }, [login]);

  useEffect(() => {
    if (token) {
      const payload = decodeToken(token);
      if (payload && payload.exp * 1000 < Date.now()) {
        logout();
      }
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
