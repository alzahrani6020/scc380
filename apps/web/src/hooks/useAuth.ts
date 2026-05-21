import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  tenant?: { name: string; slug: string };
}

export function useAuth() {
  const [user] = useState<User>({
    id: 'dev-user',
    email: 'dev@local.com',
    role: 'SUPER_ADMIN',
    firstName: 'مطور',
    lastName: 'النظام',
    tenant: { name: 'شركة التقنية المتقدمة', slug: 'advanced-tech' },
  });
  const [loading] = useState(false);

  const logout = () => {
    window.location.reload();
  };

  return { user, loading, logout, isAuthenticated: true };
}
