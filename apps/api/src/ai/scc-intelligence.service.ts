import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { AlertsService } from '../analytics/alerts.service';

export type SccDomain =
  | 'dashboard'
  | 'finance'
  | 'fleet'
  | 'hr'
  | 'crm'
  | 'erp'
  | 'projects'
  | 'alerts'
  | 'general';

@Injectable()
export class SccIntelligenceService {
  constructor(
    private analytics: AnalyticsService,
    private alerts: AlertsService,
  ) {}

  private normalize(input: string) {
    return (input || '').trim().toLowerCase();
  }

  classify(message: string): SccDomain {
    const text = this.normalize(message);

    const rules: Array<[SccDomain, string[]]> = [
      ['alerts', ['تنبيه', 'تنبيهات', 'مخاطر', 'خطر', 'متأخر', 'متأخرة', 'alerts', 'risk', 'warning']],
      ['finance', ['مالية', 'المالية', 'مصروف', 'مصروفات', 'دفعات', 'دفع', 'بنك', 'رصيد', 'finance', 'payment', 'expense', 'bank']],
      ['fleet', ['أسطول', 'مركبات', 'مركبة', 'سيارات', 'صيانة', 'رحلات', 'fleet', 'vehicle', 'maintenance', 'trip']],
      ['hr', ['موظف', 'موظفين', 'رواتب', 'إجازات', 'حضور', 'موارد بشرية', 'hr', 'employee', 'payroll', 'leave', 'attendance']],
      ['crm', ['عملاء', 'عميل', 'صفقات', 'صفقة', 'crm', 'contact', 'deal', 'customer']],
      ['erp', ['فواتير', 'فاتورة', 'erp', 'invoice', 'overdue']],
      ['projects', ['مشروع', 'مشاريع', 'مهام', 'مهمة', 'project', 'task', 'kanban']],
      ['dashboard', ['لوحة', 'ملخص', 'نظرة عامة', 'dashboard', 'overview', 'summary']],
    ];

    for (const [domain, keywords] of rules) {
      if (keywords.some(keyword => text.includes(keyword))) return domain;
    }

    return 'general';
  }

  async execute(message: string, user: { tenantId?: string; role?: string }) {
    const domain = this.classify(message);
    const tenantId = user?.tenantId;
    const role = user?.role || 'USER';

    switch (domain) {
      case 'alerts':
        return this.wrap(domain, await this.alerts.getAlerts(tenantId, role));
      case 'finance':
        return this.wrap(domain, await this.analytics.getFinanceStats(tenantId, role));
      case 'fleet':
        return this.wrap(domain, await this.analytics.getFleetStats(tenantId, role));
      case 'hr':
        return this.wrap(domain, await this.analytics.getHrStats(tenantId, role));
      case 'crm':
        return this.wrap(domain, await this.analytics.getCrmStats(tenantId, role));
      case 'erp':
        return this.wrap(domain, await this.analytics.getErpStats(tenantId, role));
      case 'projects':
        return this.wrap(domain, await this.analytics.getProjectStats(tenantId, role));
      case 'dashboard':
        return this.wrap(domain, await this.analytics.getDashboardStats(tenantId, role));
      default:
        return {
          handled: false,
          engine: 'scc-intelligence-core',
          mode: 'deterministic',
          domain,
          data: null,
        };
    }
  }

  summarize(text: string) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) {
      return {
        response: '',
        engine: 'scc-intelligence-core',
        mode: 'deterministic',
      };
    }

    const sentences = clean
      .split(/(?<=[.!؟?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);

    const selected = sentences.length <= 3
      ? sentences
      : [sentences[0], sentences[Math.floor(sentences.length / 2)], sentences[sentences.length - 1]];

    return {
      response: selected.join(' '),
      engine: 'scc-intelligence-core',
      mode: 'deterministic',
      sourceLength: clean.length,
    };
  }

  capabilities() {
    return {
      engine: 'scc-intelligence-core',
      mode: 'deterministic',
      requiresLlm: false,
      capabilities: [
        'dashboard_summary',
        'finance_snapshot',
        'fleet_snapshot',
        'hr_snapshot',
        'crm_snapshot',
        'erp_snapshot',
        'projects_snapshot',
        'operational_alerts',
        'local_extractive_summary',
        'domain_routing',
      ],
    };
  }

  private wrap(domain: SccDomain, data: unknown) {
    return {
      handled: true,
      engine: 'scc-intelligence-core',
      mode: 'deterministic',
      domain,
      data,
    };
  }
}
