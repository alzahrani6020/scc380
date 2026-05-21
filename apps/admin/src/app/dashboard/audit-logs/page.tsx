'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Search, Clock } from 'lucide-react';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function AuditLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/security/login-attempts').then((res) => setItems(res.data.data || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((l) =>
    l.email?.includes(search) || l.ipAddress?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-400" />
            سجل العمليات
          </h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} عملية</p>
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
        <div className="space-y-3">
          {filtered.map((l) => (
            <div key={l.id} className="scc-card-hover flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${l.success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <Shield className={`h-4 w-4 ${l.success ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{l.email || 'Unknown'}</h3>
                  <p className="text-slate-400 text-xs">{l.ipAddress} • {l.userAgent?.slice(0, 40)}</p>
                </div>
              </div>
              <div className="text-left flex items-center gap-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  l.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>{l.success ? 'نجاح' : 'فشل'}</span>
                <span className="text-slate-500 text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(l.createdAt).toLocaleString('ar-SA')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
