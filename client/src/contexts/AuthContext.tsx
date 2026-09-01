import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, dashboardApi } from '../lib/api';

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
  alertCount: number;
  refreshAlertCount: () => void;
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
  const [alertCount, setAlertCount] = useState(0);

  // Check session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Poll alert count for approvers every 60 seconds
  useEffect(() => {
    if (user?.role !== 'approver') {
      setAlertCount(0);
      return;
    }
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchAlertCount = async () => {
    const res = await dashboardApi.getAlertCount();
    if (res.ok && res.data) {
      setAlertCount((res.data as any).count ?? 0);
    }
  };

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
    setAlertCount(0);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, alertCount, refreshAlertCount: fetchAlertCount, login, register, logout }}>
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
