'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { GitBranch, Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [pipelineModal, setPipelineModal] = useState(false);
  const [stageModal, setStageModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<any>(null);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [pipelineForm, setPipelineForm] = useState<any>({ isActive: true, isDefault: false });
  const [stageForm, setStageForm] = useState<any>({ order: 0, probability: 0, isActive: true, isWon: false, isLost: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/crm/pipelines');
      const list = res.data || [];
      setPipelines(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
      if (selectedId && !list.some((p: any) => p.id === selectedId)) setSelectedId(list[0]?.id || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData().catch(console.error); }, []);

  const selected = useMemo(() => pipelines.find((p) => p.id === selectedId), [pipelines, selectedId]);

  const openPipeline = (p?: any) => {
    setEditingPipeline(p || null);
    setPipelineForm(p ? {
      name: p.name,
      description: p.description || '',
      isDefault: Boolean(p.isDefault),
      isActive: p.isActive !== false,
    } : { name: '', description: '', isDefault: false, isActive: true });
    setPipelineModal(true);
  };

  const savePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...pipelineForm };
    if (!payload.description) delete payload.description;
    if (editingPipeline) await api.patch('/crm/pipelines/' + editingPipeline.id, payload);
    else await api.post('/crm/pipelines', payload);
    setPipelineModal(false);
    await fetchData();
  };

  const deletePipeline = async (id: string) => {
    if (!confirm('حذف مسار المبيعات؟ لا يمكن الحذف إذا كان مستخدمًا في صفقات.')) return;
    await api.delete('/crm/pipelines/' + id);
    await fetchData();
  };

  const openStage = (stage?: any) => {
    setEditingStage(stage || null);
    setStageForm(stage ? {
      name: stage.name,
      code: stage.code,
      order: stage.order,
      probability: stage.probability,
      color: stage.color || '',
      isWon: Boolean(stage.isWon),
      isLost: Boolean(stage.isLost),
      isActive: stage.isActive !== false,
    } : {
      name: '',
      code: '',
      order: selected?.stages?.length || 0,
      probability: 0,
      color: '',
      isWon: false,
      isLost: false,
      isActive: true,
    });
    setStageModal(true);
  };

  const saveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const payload = {
      ...stageForm,
      order: Number(stageForm.order),
      probability: Number(stageForm.probability),
    };
    if (!payload.color) delete payload.color;
    if (editingStage) await api.patch('/crm/pipelines/' + selected.id + '/stages/' + editingStage.id, payload);
    else await api.post('/crm/pipelines/' + selected.id + '/stages', payload);
    setStageModal(false);
    await fetchData();
  };

  const deleteStage = async (stageId: string) => {
    if (!selected || !confirm('حذف المرحلة؟ لا يمكن حذف مرحلة مستخدمة في صفقات.')) return;
    await api.delete('/crm/pipelines/' + selected.id + '/stages/' + stageId);
    await fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary-400" />
            مسارات المبيعات
          </h1>
          <p className="text-slate-400 text-sm mt-1">مراحل ديناميكية مستقلة لكل tenant بدل الاعتماد على مراحل ثابتة فقط.</p>
        </div>
        <Button onClick={() => openPipeline()}><Plus className="h-5 w-5" /> مسار جديد</Button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
          <div className="space-y-2">
            {pipelines.map((p) => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} className={'w-full text-right scc-card-hover ' + (selectedId === p.id ? 'ring-1 ring-primary-500' : '')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{p.stages?.length || 0} مراحل {p.isDefault ? '• افتراضي' : ''}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span onClick={(e) => { e.stopPropagation(); openPipeline(p); }} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-primary-400"><Pencil className="h-4 w-4" /></span>
                    <span onClick={(e) => { e.stopPropagation(); deletePipeline(p.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="scc-card">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-white">{selected.name}</h2>
                    <p className="text-sm text-slate-500">{selected.description || 'بدون وصف'}</p>
                  </div>
                  <Button onClick={() => openStage()}><Plus className="h-4 w-4" /> مرحلة</Button>
                </div>
                <div className="space-y-2">
                  {(selected.stages || []).map((stage: any) => (
                    <div key={stage.id} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-300">{stage.order}</span>
                        <div>
                          <div className="text-white font-medium">{stage.name}</div>
                          <div className="text-xs text-slate-500">{stage.code} • {stage.probability}% {stage.isWon ? '• ربح' : ''}{stage.isLost ? '• خسارة' : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openStage(stage)} className="p-2 text-primary-400"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteStage(stage.id)} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-slate-500">أنشئ مسار مبيعات للبدء.</p>}
          </div>
        </div>
      )}

      <Modal isOpen={pipelineModal} onClose={() => setPipelineModal(false)} title={editingPipeline ? 'تعديل المسار' : 'مسار جديد'} size="lg">
        <form onSubmit={savePipeline} className="space-y-4">
          <Input label="الاسم" required value={pipelineForm.name || ''} onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })} />
          <Textarea label="الوصف" rows={3} value={pipelineForm.description || ''} onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })} />
          <div className="flex gap-4 text-sm text-slate-300">
            <label><input type="checkbox" className="ml-2" checked={Boolean(pipelineForm.isDefault)} onChange={(e) => setPipelineForm({ ...pipelineForm, isDefault: e.target.checked })} />افتراضي</label>
            <label><input type="checkbox" className="ml-2" checked={Boolean(pipelineForm.isActive)} onChange={(e) => setPipelineForm({ ...pipelineForm, isActive: e.target.checked })} />نشط</label>
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setPipelineModal(false)}><X className="h-4 w-4" /> إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
      </Modal>

      <Modal isOpen={stageModal} onClose={() => setStageModal(false)} title={editingStage ? 'تعديل المرحلة' : 'مرحلة جديدة'} size="lg">
        <form onSubmit={saveStage} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم" required value={stageForm.name || ''} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} />
            <Input label="الكود" required value={stageForm.code || ''} onChange={(e) => setStageForm({ ...stageForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} />
            <Input label="الترتيب" type="number" min="0" required value={stageForm.order ?? 0} onChange={(e) => setStageForm({ ...stageForm, order: e.target.value })} />
            <Input label="الاحتمالية %" type="number" min="0" max="100" required value={stageForm.probability ?? 0} onChange={(e) => setStageForm({ ...stageForm, probability: e.target.value })} />
            <Input label="اللون" value={stageForm.color || ''} onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label><input type="checkbox" className="ml-2" checked={Boolean(stageForm.isWon)} onChange={(e) => setStageForm({ ...stageForm, isWon: e.target.checked, isLost: e.target.checked ? false : stageForm.isLost })} />مرحلة ربح</label>
            <label><input type="checkbox" className="ml-2" checked={Boolean(stageForm.isLost)} onChange={(e) => setStageForm({ ...stageForm, isLost: e.target.checked, isWon: e.target.checked ? false : stageForm.isWon })} />مرحلة خسارة</label>
            <label><input type="checkbox" className="ml-2" checked={Boolean(stageForm.isActive)} onChange={(e) => setStageForm({ ...stageForm, isActive: e.target.checked })} />نشطة</label>
          </div>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setStageModal(false)}><X className="h-4 w-4" /> إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
      </Modal>
    </div>
  );
}
