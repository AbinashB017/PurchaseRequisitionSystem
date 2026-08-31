import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'requester' | 'approver';
  approval_limit: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: 'requester' | 'approver';
    approval_limit?: number;
  }) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await authApi.me();
      if (res.ok && res.data) {
        setUser((res.data as { user: User }).user);
      }
    } catch {
      // Not authenticated
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await authApi.login({ email, password });
    if (res.ok && res.data) {
      setUser((res.data as { user: User }).user);
      return null;
    }
    return res.error || 'Login failed';
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      name: string;
      role: 'requester' | 'approver';
      approval_limit?: number;
    }): Promise<string | null> => {
      const res = await authApi.register(data);
      if (res.ok && res.data) {
        setUser((res.data as { user: User }).user);
        return null;
      }
      return res.error || 'Registration failed';
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
