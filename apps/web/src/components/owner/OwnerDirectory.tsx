'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Tenant = { id: string; name: string; slug?: string; status?: string; plan?: string; createdAt?: string };
type User = { id: string; email: string; firstName?: string; lastName?: string; role: string; status: string; tenantId?: string | null; lastLoginAt?: string | null };
type UsersResult = { data: User[]; count: number };
type Kind = 'tenants' | 'users';

function safeDate(value?: string | null): string {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'غير متاح' : date.toLocaleDateString('ar-SA');
}

export default function OwnerDirectory({ kind }: { kind: Kind }) {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [users, setUsers] = useState<UsersResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (kind === 'tenants') {
        const response = await api.get<Tenant[]>('/tenants');
        if (!Array.isArray(response.data)) throw new Error('Unexpected tenant response');
        setTenants(response.data);
      } else {
        const response = await api.get<UsersResult>('/users');
        if (!response.data || !Array.isArray(response.data.data) || typeof response.data.count !== 'number') {
          throw new Error('Unexpected users response');
        }
        setUsers(response.data);
      }
    } catch (caught: unknown) {
      const status = (caught as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? 'الحساب لا يملك صلاحية قراءة هذه القائمة.' :
        status === 401 ? 'انتهت جلسة المصادقة أو تعذر تجديدها.' :
        'تعذر قراءة البيانات من API. لم يتم افتراض وجود سجلات أو عدم وجودها.');
      if (kind === 'tenants') setTenants(null);
      else setUsers(null);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);

  const normalized = query.trim().toLocaleLowerCase();
  const visibleTenants = (tenants ?? []).filter(item =>
    [item.name, item.slug, item.id].some(x => (x ?? '').toLocaleLowerCase().includes(normalized)));
  const visibleUsers = (users?.data ?? []).filter(item =>
    [item.email, item.firstName, item.lastName, item.role, item.status].some(x => (x ?? '').toLocaleLowerCase().includes(normalized)));

  return <section dir="rtl" className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white" aria-label={kind === 'tenants' ? 'دليل الشركات' : 'دليل المستخدمين'}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">{kind === 'tenants' ? 'الشركات المصرح بعرضها' : 'المستخدمون المصرح بعرضهم'}</h2>
        <p className="mt-1 text-sm text-slate-300">قراءة فقط عبر صلاحيات API الحالية؛ لا يمكن إنشاء أو تعديل حسابات أو صلاحيات من هذا القسم.</p>
      </div>
      <button type="button" disabled={loading} onClick={() => void load()} className="rounded-lg border border-blue-500 px-4 py-2 text-sm disabled:opacity-50">
        {loading ? 'جارٍ القراءة...' : 'تحديث القائمة'}
      </button>
    </div>
    <label className="block text-sm" htmlFor={kind + '-search'}>بحث في النتائج المعروضة</label>
    <input id={kind + '-search'} type="search" value={query} onChange={event => setQuery(event.target.value)}
      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" placeholder="ابحث بالاسم أو البريد"/>
    {error && <p role="alert" className="rounded-lg border border-amber-700 p-3 text-amber-200">{error}</p>}
    {!error && !loading && <p className="text-sm text-slate-300">
      {kind === 'tenants'
        ? `الشركات المعروضة: ${tenants?.length ?? 0} — يحدد API نطاق الشركات بحسب الدور.`
        : `المستخدمون المعروضون: ${users?.data.length ?? 0} من ${users?.count ?? 0} — API يعيد أول 200 مستخدم فقط؛ البحث محلي في الصفحة المحملة.`}
    </p>}
    {!error && !loading && <div className="overflow-x-auto rounded-lg border border-slate-700">
      {kind === 'tenants' ?
        <table className="w-full min-w-[520px] text-right text-sm">
          <thead className="bg-slate-800 text-slate-200"><tr><th className="p-3">الشركة</th><th className="p-3">المعرف</th><th className="p-3">الحالة</th><th className="p-3">الباقة</th></tr></thead>
          <tbody>{visibleTenants.map(t => <tr key={t.id} className="border-t border-slate-700"><td className="p-3">{t.name || 'غير متاح'}</td><td className="p-3 break-all">{t.slug || t.id}</td><td className="p-3">{t.status || 'غير متاح'}</td><td className="p-3">{t.plan || 'غير متاح'}</td></tr>)}</tbody>
        </table> :
        <table className="w-full min-w-[650px] text-right text-sm">
          <thead className="bg-slate-800 text-slate-200"><tr><th className="p-3">المستخدم</th><th className="p-3">البريد</th><th className="p-3">الدور</th><th className="p-3">الحالة</th><th className="p-3">آخر دخول</th></tr></thead>
          <tbody>{visibleUsers.map(u => <tr key={u.id} className="border-t border-slate-700"><td className="p-3">{[u.firstName,u.lastName].filter(Boolean).join(' ') || 'غير متاح'}</td><td className="p-3 break-all">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3">{u.status}</td><td className="p-3">{safeDate(u.lastLoginAt)}</td></tr>)}</tbody>
        </table>}
    </div>}
    {!error && !loading && (kind === 'tenants' ? visibleTenants.length === 0 : visibleUsers.length === 0) &&
      <p className="text-sm text-slate-400">لا توجد نتائج ضمن نطاق البيانات المحملة.</p>}
  </section>;
}
