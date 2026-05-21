'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Printer, ArrowRight, Download, Loader2, FileText,
  Calculator, Users, Building2, Scale, Truck, TrendingUp, Kanban
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

const categoryLabels: Record<string, string> = {
  HR: 'الموارد البشرية',
  ACCOUNTING: 'المحاسبة والمالية',
  ADMIN: 'الإدارة والتشغيل',
  LEGAL: 'العقود والقانونية',
  FLEET: 'الأسطول واللوجستيات',
  SALES: 'المبيعات والتسويق',
  PROJECTS: 'المشاريع',
};

interface Template {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  htmlTemplate: string;
  cssStyles?: string;
  templateKey: string;
  defaultData?: Record<string, any>;
  paperSize?: string;
  orientation?: string;
}

export default function TemplatePreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get('print') === '1';
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (params.id) {
      fetchTemplate();
    }
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      const res = await api.get(`/templates/${params.id}`);
      const tpl = res.data;
      setTemplate(tpl);
      // Initialize with default data + mock data for preview
      const defaults = tpl.defaultData || {};
      setLiveData(generateMockData(tpl.category, tpl.templateKey, defaults));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = (category: string, key: string, defaults: any) => {
    const base = {
      companyName: 'شركة التقنية المتقدمة',
      companyAddress: 'الرياض، المملكة العربية السعودية',
      companyPhone: '011-2345678',
      companyEmail: 'info@company.sa',
      companyCr: '1010123456',
      companyVat: '300012345600003',
      date: new Date().toLocaleDateString('ar-SA'),
      dateHijri: '١٤ ذو الحجة ١٤٤٥',
      ...defaults,
    };

    if (category === 'HR' || key.includes('employee') || key.includes('payroll')) {
      return {
        ...base,
        employeeName: 'أحمد محمد عبدالله',
        employeeId: 'EMP-001',
        employeeIdNumber: '1234567890',
        employeeNationality: 'سعودي',
        employeeJobTitle: 'مدير الموارد البشرية',
        employeeDepartment: 'الموارد البشرية',
        employeeHireDate: '2023-01-15',
        employeeBasicSalary: '15000',
        employeeHousingAllowance: '3000',
        employeeTransportAllowance: '1500',
        employeeOtherAllowances: '0',
        employeeGosiDeduction: '900',
        employeeTaxDeduction: '0',
        employeeOtherDeductions: '500',
        employeeNetSalary: '18100',
        leaveType: 'سنوية',
        leaveStartDate: '2025-06-01',
        leaveEndDate: '2025-06-10',
        leaveDays: '10',
        leaveBalance: '21',
        warningType: 'إنذار أول',
        warningReason: 'التأخر المتكرر عن العمل',
        warningDate: new Date().toLocaleDateString('ar-SA'),
        ...defaults,
      };
    }

    if (category === 'ACCOUNTING' || key.includes('invoice') || key.includes('journal')) {
      return {
        ...base,
        invoiceNumber: 'INV-2025-001',
        invoiceDate: new Date().toLocaleDateString('ar-SA'),
        invoiceDueDate: '2025-06-30',
        customerName: 'شركة المستقبل التجارية',
        customerAddress: 'جدة، المملكة العربية السعودية',
        customerVat: '300098765400002',
        subtotal: '10000.00',
        taxRate: '15',
        taxAmount: '1500.00',
        discount: '0.00',
        total: '11500.00',
        items: [
          { description: 'خدمات استشارية', quantity: 10, unitPrice: 500, total: 5000 },
          { description: 'ترخيص برنامج سنوي', quantity: 2, unitPrice: 2500, total: 5000 },
        ],
        ...defaults,
      };
    }

    if (category === 'FLEET') {
      return {
        ...base,
        vehiclePlate: 'أ ب ج 1234',
        vehicleMake: 'تويوتا',
        vehicleModel: 'لاند كروزر',
        vehicleYear: '2024',
        vehicleColor: 'أبيض',
        vehicleVin: 'JTMBU4DV3B5000000',
        driverName: 'خالد سعد الفهد',
        driverLicense: '12345678',
        maintenanceType: 'صيانة دورية',
        maintenanceDate: new Date().toLocaleDateString('ar-SA'),
        maintenanceCost: '2500',
        maintenanceMileage: '45000',
        ...defaults,
      };
    }

    return base;
  };

  const interpolateTemplate = (html: string, data: Record<string, any>) => {
    let result = html;
    // Replace simple variables {{key}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      if (value === undefined || value === null) return `{{${key}}}`;
      return String(value);
    });
    // Replace nested variables {{object.property}}
    result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, obj, prop) => {
      const arr = data[obj];
      if (Array.isArray(arr)) {
        return arr.map((item: any) => item[prop] || '').join('');
      }
      return data[`${obj}.${prop}`] || `{{${obj}.${prop}}}`;
    });
    // Handle loops {{#each items}}...{{/each}}
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, arrName, inner) => {
      const arr = data[arrName];
      if (!Array.isArray(arr)) return '';
      return arr.map((item: any) => {
        let itemHtml = inner;
        Object.entries(item).forEach(([k, v]) => {
          itemHtml = itemHtml.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
        });
        return itemHtml;
      }).join('');
    });
    return result;
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${template?.nameAr || template?.name}</title>
        <style>
          @page { size: ${template?.paperSize || 'A4'} ${template?.orientation || 'portrait'}; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; direction: rtl; }
          ${template?.cssStyles || ''}
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
        <script>window.onload = () => { setTimeout(() => window.print(), 200); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500">النموذج غير موجود</p>
      </div>
    );
  }

  const CatIcon = categoryIcons[template.category] || FileText;
  const renderedHtml = interpolateTemplate(template.htmlTemplate, liveData);

  if (isPrintMode) {
    return (
      <div ref={printRef} className="bg-white p-8" style={{ minHeight: '100vh' }}>
        <style>{template.cssStyles}</style>
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/templates" className="hover:text-blue-600">مكتبة النماذج</Link>
        <ArrowRight className="w-4 h-4" />
        <span>{categoryLabels[template.category] || template.category}</span>
        <ArrowRight className="w-4 h-4" />
        <span className="text-slate-800 font-medium">{template.nameAr || template.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
            <CatIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{template.nameAr || template.name}</h1>
            <p className="text-sm text-slate-500">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
          <button
            onClick={() => {
              const blob = new Blob([`
                <!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>${template.cssStyles || ''}</style></head><body>${renderedHtml}</body></html>
              `], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${template.templateKey}.html`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            HTML
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400 mr-2">معاينة النموذج</span>
        </div>
        <div ref={printRef} className="p-8 overflow-auto" style={{ maxHeight: '70vh' }}>
          <style>{template.cssStyles}</style>
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      </div>

      {/* Data Binding Info */}
      {template.defaultData && Object.keys(template.defaultData).length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-slate-700 mb-2">متغيرات البيانات</h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(template.defaultData).map((key) => (
              <span key={key} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded font-mono text-slate-600">
                {'{{' + key + '}}'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
