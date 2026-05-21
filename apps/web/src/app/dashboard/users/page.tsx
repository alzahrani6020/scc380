'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Users, Search, Shield, User } from 'lucide-react';

export default function UsersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/users').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((u) =>
    u.firstName?.includes(search) || u.lastName?.includes(search) || u.email?.includes(search)
  );

  const roleIcon = (role: string) => {
    if (role === 'SUPER_ADMIN') return <Shield className="h-4 w-4 text-amber-400" />;
    return <User className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-400" />
            المستخدمون
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} مستخدم</p>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => (
            <div key={u.id} className="scc-card-hover">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {u.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate">{u.firstName} {u.lastName}</h3>
                  <p className="text-slate-400 text-sm truncate">{u.email}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.role === 'SUPER_ADMIN' ? 'bg-amber-500/20 text-amber-400' :
                  u.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {roleIcon(u.role)} {u.role}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className={`inline-flex px-2 py-0.5 rounded-full ${
                  u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>{u.status}</span>
                <span>آخر دخول: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA') : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
