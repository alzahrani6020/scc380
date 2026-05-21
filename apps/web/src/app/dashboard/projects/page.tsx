'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { FolderKanban, Plus, Search, Calendar, TrendingUp, CheckCircle2, Clock, AlertCircle, Pencil, Trash2, X, MoveRight } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

const projectStatuses = [
  { value: 'PLANNING', label: 'تخطيط' },
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'ON_HOLD', label: 'معلق' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغى' },
];

const priorities = [
  { value: 'LOW', label: 'منخفض' },
  { value: 'MEDIUM', label: 'متوسط' },
  { value: 'HIGH', label: 'عالي' },
  { value: 'CRITICAL', label: 'حرج' },
];

const taskStatuses = [
  { value: 'TODO', label: 'للقيام به' },
  { value: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { value: 'IN_REVIEW', label: 'قيد المراجعة' },
  { value: 'DONE', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغى' },
];

const taskPriorities = [
  { value: 'LOW', label: 'منخفض' },
  { value: 'MEDIUM', label: 'متوسط' },
  { value: 'HIGH', label: 'عالي' },
  { value: 'URGENT', label: 'عاجل' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [projectForm, setProjectForm] = useState<any>({});
  const [taskForm, setTaskForm] = useState<any>({});
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    Promise.all([
      api.get('/projects').then(r => setProjects(r.data.data || [])),
      api.get('/projects/tasks').then(r => setTasks(r.data.data || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  };

  const openProjectCreate = () => {
    setEditingProject(null);
    setProjectForm({ status: 'PLANNING', priority: 'MEDIUM', progress: 0 });
    setIsProjectModalOpen(true);
  };

  const openProjectEdit = (p: any) => {
    setEditingProject(p);
    setProjectForm({
      ...p,
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
    });
    setIsProjectModalOpen(true);
  };

  const openTaskCreate = (projectId?: string) => {
    setEditingTask(null);
    setTaskForm({ status: 'TODO', priority: 'MEDIUM', boardColumn: 'TODO', projectId: projectId || '' });
    setIsTaskModalOpen(true);
  };

  const openTaskEdit = (t: any) => {
    setEditingTask(t);
    setTaskForm({
      ...t,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
    });
    setIsTaskModalOpen(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingProject) {
        await api.patch(`/projects/${editingProject.id}`, projectForm);
      } else {
        await api.post('/projects', projectForm);
      }
      setIsProjectModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingTask) {
        await api.patch(`/projects/tasks/${editingTask.id}`, taskForm);
      } else {
        await api.post('/projects/tasks', taskForm);
      }
      setIsTaskModalOpen(false);
      fetchData();
    } catch (err) {
      alert('حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/projects/${id}`);
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('هل أنت متأكد؟')) return;
    await api.delete(`/projects/tasks/${id}`);
    fetchData();
  };

  const moveTask = async (taskId: string, newColumn: string) => {
    await api.patch(`/projects/tasks/${taskId}`, { boardColumn: newColumn, status: newColumn });
    fetchData();
  };

  const filteredProjects = projects.filter((p) => p.name?.includes(search) || p.description?.includes(search));

  const kanbanColumns = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const columnLabels: Record<string, string> = { TODO: 'للقيام به', IN_PROGRESS: 'قيد التنفيذ', IN_REVIEW: 'قيد المراجعة', DONE: 'مكتمل' };
  const columnColors: Record<string, string> = { TODO: 'bg-slate-700/50 border-slate-600', IN_PROGRESS: 'bg-blue-500/10 border-blue-500/30', IN_REVIEW: 'bg-amber-500/10 border-amber-500/30', DONE: 'bg-emerald-500/10 border-emerald-500/30' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary-400" />
            إدارة المشاريع
          </h1>
          <p className="text-slate-400 text-sm mt-1">{projects.length} مشروع | {tasks.length} مهمة</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-sm ${view === 'list' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>قائمة</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-sm ${view === 'kanban' ? 'bg-primary-500 text-white' : 'text-slate-400'}`}>Kanban</button>
          </div>
          <Button onClick={openProjectCreate}><Plus className="h-5 w-5" /> مشروع جديد</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input type="text" placeholder="البحث..." className="scc-input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => (
            <div key={p.id} className="scc-card-hover group">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">{p.name}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openProjectEdit(p)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDeleteProject(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="text-slate-400 text-sm line-clamp-2 mb-3">{p.description || '—'}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>التقدم</span><span>{p.progress || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all" style={{ width: `${p.progress || 0}%` }} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.startDate ? new Date(p.startDate).toLocaleDateString('ar-SA') : '—'}</span>
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {p.budget ? `${Number(p.budget).toLocaleString()} ر.س` : '—'}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => openTaskCreate(p.id)}><Plus className="h-3 w-3" /> مهمة</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map((col) => (
            <div key={col} className="min-w-[280px] flex-1">
              <div className={`rounded-xl border p-3 ${columnColors[col]}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    {col === 'DONE' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : col === 'IN_PROGRESS' ? <Clock className="h-4 w-4 text-blue-400" /> : <AlertCircle className="h-4 w-4 text-slate-400" />}
                    {columnLabels[col]}
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => openTaskCreate()}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="space-y-2">
                  {tasks.filter((t: any) => (t.boardColumn || t.status) === col).map((t: any) => (
                    <div key={t.id} className="bg-slate-800/80 rounded-lg p-3 cursor-pointer hover:bg-slate-800 transition-colors group">
                      <div className="flex items-start justify-between">
                        <p className="text-white text-sm font-medium">{t.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openTaskEdit(t)} className="p-1 rounded hover:bg-primary-500/10 text-primary-400"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => handleDeleteTask(t.id)} className="p-1 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' : t.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>{t.priority}</span>
                        {t.dueDate && <span className="text-[10px] text-slate-500">{new Date(t.dueDate).toLocaleDateString('ar-SA')}</span>}
                      </div>
                      <div className="mt-2 flex gap-1">
                        {kanbanColumns.filter(c => c !== col).map(c => (
                          <button key={c} onClick={() => moveTask(t.id, c)} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors flex items-center gap-1">
                            <MoveRight className="h-2 w-2" /> {columnLabels[c]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title={editingProject ? 'تعديل مشروع' : 'مشروع جديد'} size="lg">
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <Input label="الاسم" required value={projectForm.name || ''} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
          <Textarea label="الوصف" rows={3} value={projectForm.description || ''} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="الحالة" options={projectStatuses} value={projectForm.status || 'PLANNING'} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} />
            <Select label="الأولوية" options={priorities} value={projectForm.priority || 'MEDIUM'} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} />
            <Input label="تاريخ البدء" type="date" value={projectForm.startDate || ''} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} />
            <Input label="تاريخ الانتهاء" type="date" value={projectForm.endDate || ''} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} />
            <Input label="الميزانية" type="number" value={projectForm.budget || ''} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} />
            <Input label="التقدم %" type="number" min="0" max="100" value={projectForm.progress || 0} onChange={(e) => setProjectForm({ ...projectForm, progress: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsProjectModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editingProject ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={editingTask ? 'تعديل مهمة' : 'مهمة جديدة'}>
        <form onSubmit={handleTaskSubmit} className="space-y-4">
          <Input label="العنوان" required value={taskForm.title || ''} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
          <Textarea label="الوصف" rows={2} value={taskForm.description || ''} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          <Select label="المشروع" options={projects.map(p => ({ value: p.id, label: p.name }))} value={taskForm.projectId || ''} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="الحالة" options={taskStatuses} value={taskForm.status || 'TODO'} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value, boardColumn: e.target.value })} />
            <Select label="الأولوية" options={taskPriorities} value={taskForm.priority || 'MEDIUM'} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} />
            <Input label="تاريخ الاستحقاق" type="date" value={taskForm.dueDate || ''} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            <Input label="ساعات متوقعة" type="number" value={taskForm.estimatedHours || ''} onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
            <Button type="submit" isLoading={formLoading}>{editingTask ? 'حفظ' : 'إنشاء'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
