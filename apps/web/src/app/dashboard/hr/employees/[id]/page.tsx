'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import {
  ArrowRight, BadgeDollarSign, Briefcase, Building2, CalendarDays,
  ClipboardList, Mail, Phone, RefreshCw, UserRound
} from 'lucide-react';

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [employee, setEmployee] = useState<any>(null);
  const [department, setDepartment] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/hr/employees/${id}`),
      api.get(`/hr/attendances?employeeId=${encodeURIComponent(id)}`),
      api.get(`/hr/leaves?employeeId=${encodeURIComponent(id)}`),
      api.get(`/hr/payrolls?employeeId=${encodeURIComponent(id)}`),
      api.get('/hr/departments'),
    ]).then(([empRes, attRes, leaveRes, payRes, deptRes]) => {
      const emp = empRes.data;
      const departments = deptRes.data?.data || [];
      setEmployee(emp);
      setDepartment(departments.find((d: any) => d.id === emp.departmentId) || null);
      setAttendance(attRes.data?.data || []);
      setLeaves(leaveRes.data?.data || []);
      setPayrolls(payRes.data?.data || []);
    }).catch((e) => {
      console.error(e);
      setError('تعذر تحميل ملف الموظف');
    }).finally(() => setLoading(false));
  }, [id]);

  const totals = useMemo(() => {
    const approvedLeaveDays = leaves
      .filter((l) => l.status === 'APPROVED')
      .reduce((sum, l) => sum + Number(l.days || 0), 0);
    const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
    const lateDays = attendance.filter((a) => a.status === 'LATE').length;
    const paidPayrolls = payrolls.filter((p) => p.status === 'PAID');
    const lastPayroll = payrolls[0] || null;
    return { approvedLeaveDays, presentDays, lateDays, paidPayrolls, lastPayroll };
  }, [attendance, leaves, payrolls]);

  if (loading) {
    return <div className="h-72 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>;
  }

  if (error || !employee) {
    return (
      <div className="scc-card">
        <p className="text-red-400">{error || 'الموظف غير موجود'}</p>
        <Link href="/dashboard/hr/employees" className="inline-flex mt-4 text-primary-400">العودة للموظفين</Link>
      </div>
    );
  }

  const salary = Number(employee.basicSalary || 0);
  const allowances = Number(employee.housingAllowance || 0) + Number(employee.transportAllowance || 0) + Number(employee.otherAllowances || 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {employee.firstName?.charAt(0)}
          </div>
          <div>
            <Link href="/dashboard/hr/employees" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2">
              <ArrowRight className="h-4 w-4" />
              الموظفون
            </Link>
            <h1 className="text-2xl font-bold text-white">{employee.firstName} {employee.lastName}</h1>
            <p className="text-slate-400">{employee.jobTitle || 'بدون مسمى وظيفي'} · {employee.employeeCode}</p>
          </div>
        </div>
        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
          employee.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
          employee.status === 'ON_LEAVE' ? 'bg-amber-500/20 text-amber-400' :
          'bg-slate-500/20 text-slate-300'
        }`}>{employee.status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="scc-card lg:col-span-2">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><UserRound className="h-5 w-5 text-primary-400" /> البيانات الأساسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300"><Mail className="h-4 w-4 text-slate-500" />{employee.email || '—'}</div>
            <div className="flex items-center gap-2 text-slate-300"><Phone className="h-4 w-4 text-slate-500" />{employee.phone || '—'}</div>
            <div className="flex items-center gap-2 text-slate-300"><Building2 className="h-4 w-4 text-slate-500" />{department?.name || 'بدون إدارة'}</div>
            <div className="flex items-center gap-2 text-slate-300"><Briefcase className="h-4 w-4 text-slate-500" />{employee.employmentType}</div>
            <div className="text-slate-400">تاريخ التعيين: <span className="text-white">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ar-SA') : '—'}</span></div>
            <div className="text-slate-400">الجنسية: <span className="text-white">{employee.nationality || '—'}</span></div>
            <div className="text-slate-400">رقم الهوية: <span className="text-white">{employee.idNumber || '—'}</span></div>
            <div className="text-slate-400">رقم التأمينات: <span className="text-white">{employee.gosiNumber || '—'}</span></div>
          </div>
        </div>

        <div className="scc-card">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-primary-400" /> التعويضات</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">الراتب الأساسي</span><span className="text-white">{salary.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between"><span className="text-slate-400">البدلات</span><span className="text-white">{allowances.toLocaleString()} ر.س</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-3"><span className="text-slate-300 font-medium">الإجمالي</span><span className="text-primary-400 font-bold">{(salary + allowances).toLocaleString()} ر.س</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/dashboard/hr/attendance?employeeId=${employee.id}`} className="scc-card-hover">
          <ClipboardList className="h-5 w-5 text-emerald-400 mb-3" />
          <p className="text-2xl font-bold text-white">{totals.presentDays}</p>
          <p className="text-slate-400 text-sm">أيام حضور</p>
          {totals.lateDays > 0 && <p className="text-amber-400 text-xs mt-1">{totals.lateDays} تأخير</p>}
        </Link>
        <Link href={`/dashboard/hr/leaves?employeeId=${employee.id}`} className="scc-card-hover">
          <CalendarDays className="h-5 w-5 text-amber-400 mb-3" />
          <p className="text-2xl font-bold text-white">{totals.approvedLeaveDays}</p>
          <p className="text-slate-400 text-sm">أيام إجازة معتمدة</p>
        </Link>
        <Link href={`/dashboard/hr/payroll?employeeId=${employee.id}`} className="scc-card-hover">
          <BadgeDollarSign className="h-5 w-5 text-primary-400 mb-3" />
          <p className="text-2xl font-bold text-white">{totals.paidPayrolls.length}</p>
          <p className="text-slate-400 text-sm">مسيرات مدفوعة</p>
        </Link>
        <div className="scc-card">
          <Briefcase className="h-5 w-5 text-violet-400 mb-3" />
          <p className="text-lg font-bold text-white">{totals.lastPayroll ? `${totals.lastPayroll.month}/${totals.lastPayroll.year}` : '—'}</p>
          <p className="text-slate-400 text-sm">آخر مسير راتب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="scc-card">
          <h3 className="text-white font-semibold mb-3">آخر الحضور</h3>
          <div className="space-y-2">
            {attendance.slice(0, 5).map((a) => (
              <div key={a.id} className="flex justify-between text-sm border-b border-slate-800/70 pb-2">
                <span className="text-slate-300">{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                <span className="text-slate-400">{a.status}</span>
              </div>
            ))}
            {attendance.length === 0 && <p className="text-slate-500 text-sm">لا توجد سجلات</p>}
          </div>
        </div>

        <div className="scc-card">
          <h3 className="text-white font-semibold mb-3">آخر الإجازات</h3>
          <div className="space-y-2">
            {leaves.slice(0, 5).map((l) => (
              <div key={l.id} className="flex justify-between text-sm border-b border-slate-800/70 pb-2">
                <span className="text-slate-300">{l.type} · {l.days} يوم</span>
                <span className="text-slate-400">{l.status}</span>
              </div>
            ))}
            {leaves.length === 0 && <p className="text-slate-500 text-sm">لا توجد طلبات</p>}
          </div>
        </div>

        <div className="scc-card">
          <h3 className="text-white font-semibold mb-3">آخر الرواتب</h3>
          <div className="space-y-2">
            {payrolls.slice(0, 5).map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-slate-800/70 pb-2">
                <span className="text-slate-300">{p.month}/{p.year}</span>
                <span className="text-slate-400">{Number(p.netSalary).toLocaleString()} ر.س · {p.status}</span>
              </div>
            ))}
            {payrolls.length === 0 && <p className="text-slate-500 text-sm">لا توجد مسيرات</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
