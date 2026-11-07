import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SccIntelligenceService } from './scc-intelligence.service';

@Injectable()
export class AiService {
  private ollamaUrl?: string;

  constructor(
    private config: ConfigService,
    private intelligence: SccIntelligenceService,
  ) {
    this.ollamaUrl = this.config.get('OLLAMA_URL') || undefined;
  }

  async chat(message: string, context?: string, user?: { tenantId?: string; role?: string }) {
    const local = await this.intelligence.execute(message, user || {});

    if (local.handled) {
      return {
        response: this.describeLocalResult(local.domain, local.data),
        model: 'scc-intelligence-core',
        engine: 'scc-intelligence-core',
        mode: 'deterministic',
        domain: local.domain,
        data: local.data,
      };
    }

    if (!this.ollamaUrl) {
      return {
        response: 'يمكنني حالياً تنفيذ الملخصات التشغيلية للمالية والأسطول والموارد البشرية والعملاء والفواتير والمشاريع ولوحة المؤشرات. اطلب المجال المطلوب مباشرة.',
        model: 'scc-intelligence-core',
        engine: 'scc-intelligence-core',
        mode: 'deterministic',
        fallback: true,
      };
    }

    try {
      const systemPrompt = context === 'crm'
        ? 'You are an AI assistant for a CRM/ERP system called Smart Command Center (SCC 380). Help users with business operations, customer management, and analytics. Answer in Arabic or English based on the user query.'
        : 'You are a helpful AI assistant for SCC 380. Answer concisely.';

      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tinyllama',
          prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 300,
          },
        }),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

      const data: any = await response.json();
      return {
        response: data.response?.trim() || 'لم أفهم، هل يمكنك التوضيح؟',
        model: 'tinyllama',
        engine: 'ollama',
        mode: 'llm',
      };
    } catch {
      return {
        response: 'المحرك اللغوي الاختياري غير متاح، لكن قدرات SCC التشغيلية المحلية ما زالت تعمل.',
        model: 'scc-intelligence-core',
        engine: 'scc-intelligence-core',
        mode: 'deterministic',
        fallback: true,
      };
    }
  }

  async summarize(text: string) {
    return this.intelligence.summarize(text);
  }

  async getModels() {
    return {
      models: [
        {
          name: 'scc-intelligence-core',
          type: 'deterministic',
          available: true,
          requiresLlm: false,
        },
        {
          name: 'tinyllama',
          type: 'ollama',
          available: Boolean(this.ollamaUrl),
          requiresLlm: true,
        },
      ],
      ...this.intelligence.capabilities(),
    };
  }

  private describeLocalResult(domain: string, data: any) {
    if (domain === 'finance') {
      return `الملخص المالي الحالي: الرصيد البنكي ${Number(data?.totalBankBalance || 0)}، المصروفات ${Number(data?.totalExpenses || 0)}، والمدفوعات المكتملة ${Number(data?.totalPayments || 0)}.`;
    }
    if (domain === 'fleet') {
      return `ملخص الأسطول: ${Number(data?.inMaintenance || 0)} مركبة في الصيانة و${Number(data?.activeTrips || 0)} رحلة نشطة.`;
    }
    if (domain === 'hr') {
      return `ملخص الموارد البشرية: متوسط الراتب ${Number(data?.avgSalary || 0)}، إجمالي الرواتب المدفوعة ${Number(data?.totalPayroll || 0)}، و${Number(data?.pendingLeaves || 0)} طلب إجازة معلق.`;
    }
    if (domain === 'projects') {
      return `ملخص المشاريع: متوسط التقدم ${Number(data?.avgProgress || 0)}%، والمهام المتأخرة ${Number(data?.overdueTasks || 0)}.`;
    }
    if (domain === 'erp') {
      return `ملخص الفواتير: الإيراد المدفوع ${Number(data?.totalRevenue || 0)}، والفواتير المتأخرة ${Number(data?.overdue || 0)}.`;
    }
    if (domain === 'crm') {
      return 'تم جلب ملخص CRM الفعلي من بيانات المستأجر الحالي.';
    }
    if (domain === 'dashboard') {
      return 'تم جلب ملخص لوحة المؤشرات الفعلي من بيانات المستأجر الحالي.';
    }
    return 'تم تنفيذ القدرة المحلية بنجاح.';
  }
}
