import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearAuth } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  tenant?: { name: string; slug: string };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const logout = () => {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };

  return {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
    refresh: loadUser,
  };
}
