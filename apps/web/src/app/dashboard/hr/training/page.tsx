'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertTriangle, GraduationCap, Plus, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

interface Course {
  id: string; code: string; title: string;
  status: 'PLANNED' | 'OPEN' | 'COMPLETED' | 'CANCELLED';
  capacity: number | null;
  _count?: { enrollments: number };
}
interface Enrollment {
  id: string; status: string;
  employee?: { firstName: string; lastName: string };
  course?: { title: string };
}
interface Employee { id: string; firstName: string; lastName: string; status: string }

function message(error: unknown): string {
  const response = error as { response?: { data?: { message?: string | string[] } } };
  const detail = response.response?.data?.message;
  if (Array.isArray(detail)) return detail.join('، ');
  if (typeof detail === 'string' && detail.trim()) return detail;
  return 'تعذر تنفيذ العملية؛ تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة';
}

const courseLabels: Record<Course['status'], string> = {
  PLANNED: 'مخططة', OPEN: 'مفتوحة', COMPLETED: 'مكتملة', CANCELLED: 'ملغاة',
};

export default function TrainingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState<'course' | 'enroll' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [courseResult, enrollmentResult, employeeResult] = await Promise.all([
        api.get('/hr/training/courses'),
        api.get('/hr/training/enrollments'),
        api.get('/hr/employees?limit=200'),
      ]);
      setCourses(courseResult.data.data || []);
      setEnrollments(enrollmentResult.data.data || []);
      setEmployees(employeeResult.data.data || []);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, success: string, close = false) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (close) { setOpen(null); setForm({}); }
      setNotice(success);
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setSaving(false);
    }
  };

  const createCourse = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(() => api.post('/hr/training/courses', {
      code: form.code?.trim(), title: form.title?.trim(),
      ...(form.capacity ? { capacity: Number(form.capacity) } : {}),
    }), 'أنشئت الدورة بنجاح. افتح الدورة للتسجيل.', true);
  };
  const enroll = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(() => api.post('/hr/training/enrollments', form), 'تم تسجيل الموظف في الدورة', true);
  };
  const changeStatus = (course: Course, status: 'OPEN' | 'COMPLETED' | 'CANCELLED') => {
    if (status === 'CANCELLED' && !window.confirm('تأكيد إلغاء الدورة؟')) return;
    void run(() => api.patch(`/hr/training/courses/${course.id}/status`, { status }),
      status === 'OPEN' ? 'الدورة مفتوحة للتسجيل' : status === 'COMPLETED' ? 'تم إغلاق الدورة' : 'ألغيت الدورة');
  };
  const complete = (enrollment: Enrollment) => {
    const input = window.prompt('النتيجة من 0 إلى 100:', '90');
    if (input === null) return;
    const score = Number(input.trim());
    if (!input.trim() || !Number.isFinite(score) || score < 0 || score > 100) {
      setError('النتيجة يجب أن تكون رقمًا من 0 إلى 100');
      return;
    }
    void run(() => api.post(`/hr/training/enrollments/${enrollment.id}/complete`, { score }), 'تم إكمال تدريب الموظف');
  };

  const eligibleCourses = courses.filter(course => course.status === 'OPEN');
  const activeEmployees = employees.filter(employee => employee.status === 'ACTIVE');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <GraduationCap className="h-6 w-6 text-primary-400" /> التدريب والتطوير
          </h1>
          <p className="text-sm text-slate-300">تخطيط الدورة، فتح التسجيل، تسجيل الموظفين، والنتائج</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setForm({}); setOpen('course'); }} disabled={saving}>دورة جديدة</Button>
          <Button onClick={() => { setForm({}); setOpen('enroll'); }} disabled={saving || eligibleCourses.length === 0}>
            <Plus className="h-4 w-4" /> تسجيل موظف
          </Button>
          <Button variant="ghost" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
        <AlertTriangle className="h-5 w-5 shrink-0" /> <span>{error}</span>
        <button className="mr-auto underline" onClick={() => void load()}>إعادة المحاولة</button>
      </div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</div>}
      {loading && <p role="status" className="text-sm text-slate-300">جارٍ تحميل بيانات التدريب...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map(course => (
          <div key={course.id} className="scc-card space-y-3">
            <div className="font-bold text-white">{course.title}</div>
            <div className="text-sm text-slate-300">
              {course.code} · {courseLabels[course.status] || course.status} · {course._count?.enrollments || 0} مسجل
              {course.capacity !== null ? ` · السعة ${course.capacity}` : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              {course.status === 'PLANNED' && <Button size="sm" onClick={() => changeStatus(course, 'OPEN')} disabled={saving}>فتح التسجيل</Button>}
              {course.status === 'OPEN' && <>
                <Button size="sm" onClick={() => changeStatus(course, 'COMPLETED')} disabled={saving}>إغلاق الدورة</Button>
                <Button size="sm" variant="ghost" onClick={() => changeStatus(course, 'CANCELLED')} disabled={saving}>إلغاء</Button>
              </>}
              {course.status === 'PLANNED' && <Button size="sm" variant="ghost" onClick={() => changeStatus(course, 'CANCELLED')} disabled={saving}>إلغاء</Button>}
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && courses.length === 0 && <p className="text-sm text-slate-300">لا توجد دورات بعد. أنشئ دورة جديدة أولًا.</p>}

      <div className="scc-card space-y-2">
        <h2 className="font-semibold text-white">التسجيلات</h2>
        {enrollments.map(enrollment => (
          <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 py-3">
            <div>
              <div className="text-white">{enrollment.employee?.firstName} {enrollment.employee?.lastName}</div>
              <div className="text-sm text-slate-300">{enrollment.course?.title} · {enrollment.status}</div>
            </div>
            {enrollment.status === 'ENROLLED' && <Button size="sm" onClick={() => complete(enrollment)} disabled={saving}>إكمال</Button>}
          </div>
        ))}
        {!loading && !error && enrollments.length === 0 && <p className="text-sm text-slate-300">لا توجد تسجيلات بعد.</p>}
      </div>

      <Modal isOpen={open === 'course'} onClose={() => { if (!saving) setOpen(null); }} title="إنشاء دورة">
        <form onSubmit={createCourse} className="space-y-3">
          <Input label="الكود" required value={form.code || ''} onChange={event => setForm({ ...form, code: event.target.value })} />
          <Input label="اسم الدورة" required value={form.title || ''} onChange={event => setForm({ ...form, title: event.target.value })} />
          <Input label="السعة" type="number" value={form.capacity || ''} onChange={event => setForm({ ...form, capacity: event.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ' : 'إنشاء'}</Button>
        </form>
      </Modal>
      <Modal isOpen={open === 'enroll'} onClose={() => { if (!saving) setOpen(null); }} title="تسجيل موظف">
        <form onSubmit={enroll} className="space-y-3">
          <Select label="الدورة المفتوحة" required options={eligibleCourses.map(course => ({ value: course.id, label: `${course.code} · ${course.title}` }))}
            value={form.courseId || ''} onChange={event => setForm({ ...form, courseId: event.target.value })} />
          <Select label="الموظف النشط" required options={activeEmployees.map(employee => ({ value: employee.id, label: `${employee.firstName} ${employee.lastName}` }))}
            value={form.employeeId || ''} onChange={event => setForm({ ...form, employeeId: event.target.value })} />
          <Button type="submit" disabled={saving}>{saving ? 'جارٍ التسجيل' : 'تسجيل'}</Button>
        </form>
      </Modal>
    </div>
  );
}
