'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Shield, Key, LogOut, Globe, Clock, Plus, X, Copy, Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function SecurityPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/security/sessions/me').then(r => setSessions(r.data.data || [])),
      api.get('/security/api-keys').then(r => setApiKeys(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const revokeSession = async (id: string) => {
    await api.delete(`/security/sessions/${id}`);
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const revokeAll = async () => {
    await api.post('/security/sessions/revoke-all');
    setSessions([]);
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await api.post('/security/api-keys', { name: newKeyName });
      setGeneratedKey(res.data.key);
      setNewKeyName('');
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    await api.delete(`/security/api-keys/${id}`);
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-400" />
            الأمان
          </h1>
          <p className="text-slate-400 text-sm mt-1">إدارة الجلسات ومفاتيح API</p>
        </div>
      </div>

      <div className="scc-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Globe className="h-5 w-5 text-primary-400" /> الجلسات النشطة</h3>
          <Button variant="danger" size="sm" onClick={revokeAll}><LogOut className="h-4 w-4" /> إنهاء الكل</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">{s.deviceInfo || s.userAgent?.slice(0, 40) || 'Unknown'}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {s.ipAddress} • آخر نشاط: {new Date(s.lastActiveAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => revokeSession(s.id)}>إنهاء</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="scc-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Key className="h-5 w-5 text-amber-400" /> مفاتيح API</h3>
          <Button size="sm" onClick={() => { setGeneratedKey(null); setIsKeyModalOpen(true); }}><Plus className="h-4 w-4" /> مفتاح جديد</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Key className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">{k.name}</p>
                    <p className="text-slate-500 text-xs font-mono">{k.key} • آخر استخدام: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('ar-SA') : '—'}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => revokeKey(k.id)}>إلغاء</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} title="مفتاح API جديد">
        {generatedKey ? (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-emerald-400 text-sm font-medium mb-2">تم إنشاء المفتاح بنجاح! انسخه الآن لأنك لن تتمكن من رؤيته مرة أخرى.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-950 rounded-lg px-3 py-2 text-sm font-mono text-white break-all">{generatedKey}</code>
                <Button size="sm" onClick={() => copyToClipboard(generatedKey)}>
                  {copiedKey === generatedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setIsKeyModalOpen(false); setGeneratedKey(null); }}>تم</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={createKey} className="space-y-4">
            <Input label="اسم المفتاح" required placeholder="مثال: تطبيق الجوال" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsKeyModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
              <Button type="submit" isLoading={formLoading}>إنشاء</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
