'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Users, Calculator, Building2, Scale, Truck, TrendingUp, Kanban,
  FileText, Search, Printer, Eye, ChevronLeft
} from 'lucide-react';

const categoryIcons: Record<string, any> = {
  HR: Users,
  ACCOUNTING: Calculator,
  ADMIN: Building2,
  LEGAL: Scale,
  FLEET: Truck,
  SALES: TrendingUp,
  PROJECTS: Kanban,
};

const categoryColors: Record<string, string> = {
  HR: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCOUNTING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
  LEGAL: 'bg-purple-50 text-purple-700 border-purple-200',
  FLEET: 'bg-orange-50 text-orange-700 border-orange-200',
  SALES: 'bg-rose-50 text-rose-700 border-rose-200',
  PROJECTS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

interface Template {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  subcategory?: string;
  description?: string;
  templateKey: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface Category {
  key: string;
  label: string;
  labelEn: string;
  icon: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/templates/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === 'ALL' || t.category === activeCategory;
    const matchSearch =
      !search ||
      t.nameAr?.includes(search) ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.templateKey?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && t.isActive;
  });

  const grouped = filtered.reduce((acc, t) => {
    const cat = t.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">مكتبة النماذج الإلكترونية</h1>
          <p className="text-slate-500 mt-1">جميع النماذج الإدارية والمحاسبية والقانونية جاهزة للطباعة والتصدير</p>
        </div>
        <div className="text-sm text-slate-400">
          {filtered.length} نموذج متاح
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="ابحث في النماذج..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory('ALL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          الكل
        </button>
        {categories.map((cat) => {
          const Icon = categoryIcons[cat.key] || FileText;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeCategory === cat.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p>لا توجد نماذج مطابقة للبحث</p>
        </div>
      ) : (
        (Object.entries(grouped) as [string, Template[]][]).map(([catKey, items]) => {
          const cat = categories.find((c) => c.key === catKey);
          const colorClass = categoryColors[catKey] || 'bg-slate-50 text-slate-700 border-slate-200';
          const Icon = categoryIcons[catKey] || FileText;
          return (
            <div key={catKey} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{cat?.label || catKey}</h2>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="group bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      {t.isSystem && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          نظامي
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">{t.nameAr || t.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">{t.description || 'نموذج جاهز للاستخدام والطباعة'}</p>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/templates/${t.id}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white text-sm py-2 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        معاينة
                      </Link>
                      <button
                        onClick={() => window.open(`/dashboard/templates/${t.id}?print=1`, '_blank')}
                        className="flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-sm py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
