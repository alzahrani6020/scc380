import { Injectable, Logger } from '@nestjs/common';
import { prisma, tenantWhere, Prisma, InvoiceStatus } from '@scc/database';

/**
 * Rule-based insights core: answers business questions directly from the
 * tenant's own database. No LLM involved — 100% accurate for factual
 * questions and available even when no LLM provider is configured.
 */
@Injectable()
export class InsightsService {
  private logger = new Logger('InsightsService');

  /** Returns an Arabic answer when the question matches a known intent */
  async tryAnswer(message: string, tenantId: string | null): Promise<string | null> {
    const msg = message.trim();
    try {
      if (this.matches(msg, [/متأخر/, /غير مسدد/, /مستحق/]) && this.matches(msg, [/فاتور/])) {
        return await this.overdueInvoices(tenantId);
      }
      if (this.matches(msg, [/استمار/, /تأمين/, /فحص دوري/, /رخصة/, /مستندات/]) && this.matches(msg, [/مركب/, /سيار/, /شاحن/, /استمار/, /تأمين/, /فحص/])) {
        return await this.fleetExpirations(tenantId);
      }
      if (this.matches(msg, [/إيراد/, /ايراد/, /مقبوضات/, /تحصيل/])) {
        return await this.revenue(tenantId);
      }
      if (this.matches(msg, [/صفق/])) {
        return await this.deals(tenantId);
      }
      if (this.matches(msg, [/تنبيه/])) {
        return await this.alerts(tenantId);
      }
      const countAnswer = await this.countIntent(msg, tenantId);
      if (countAnswer) return countAnswer;
      if (this.matches(msg, [/سلام|مرحبا|مرحباً|اهلا|أهلا|هاي|صباح|مساء/])) {
        return this.greeting();
      }
    } catch (error) {
      this.logger.error(
        'Insights query failed',
        error instanceof Error ? error.message : undefined,
      );
      return null; // fall through to the LLM path
    }
    return null;
  }

  private matches(msg: string, patterns: RegExp[]) {
    return patterns.some((p) => p.test(msg));
  }

  private fmt(n: number) {
    return n.toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  }

  private async overdueInvoices(tenantId: string | null): Promise<string> {
    const where: Prisma.InvoiceWhereInput = {
      ...tenantWhere(tenantId),
      dueDate: { lt: new Date() },
      status: { notIn: ['PAID', 'CANCELLED', 'ARCHIVED'] as InvoiceStatus[] },
    };
    const [count, agg, top] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ where, _sum: { total: true } }),
      prisma.invoice.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: 3,
        select: { invoiceNumber: true, total: true, dueDate: true },
      }),
    ]);
    if (count === 0) {
      return 'لا توجد فواتير متأخرة السداد — كل الفواتير إما مسددة أو ضمن مهلة السداد.';
    }
    const total = this.fmt(Number(agg._sum.total || 0));
    const lines = top
      .map(
        (i) =>
          `• فاتورة #${i.invoiceNumber} — ${this.fmt(Number(i.total))} ر.س (مستحقة منذ ${i.dueDate.toISOString().slice(0, 10)})`,
      )
      .join('\n');
    return `لديك ${count} فاتورة متأخرة السداد بإجمالي ${total} ر.س.\nالأقدم:\n${lines}`;
  }

  private async fleetExpirations(tenantId: string | null): Promise<string> {
    const now = Date.now();
    const soon = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const where: Prisma.VehicleWhereInput = {
      ...tenantWhere(tenantId),
      OR: [
        { istimaraExpiry: { lte: soon } },
        { insuranceExpiry: { lte: soon } },
        { periodicInspectionExpiry: { lte: soon } },
      ],
    };
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        plateNumber: true,
        istimaraExpiry: true,
        insuranceExpiry: true,
        periodicInspectionExpiry: true,
      },
      take: 100,
    });
    const labels: Array<[keyof typeof vehicles[number], string]> = [
      ['istimaraExpiry', 'الاستمارة'],
      ['insuranceExpiry', 'التأمين'],
      ['periodicInspectionExpiry', 'الفحص الدوري'],
    ];
    const items: Array<{ days: number; text: string }> = [];
    for (const v of vehicles) {
      for (const [field, label] of labels) {
        const exp = v[field] as Date | null;
        if (!exp) continue;
        const days = Math.ceil((exp.getTime() - now) / (24 * 60 * 60 * 1000));
        if (days > 30) continue;
        items.push({
          days,
          text:
            days < 0
              ? `• لوحة ${v.plateNumber}: ${label} منتهية منذ ${-days} يوم`
              : `• لوحة ${v.plateNumber}: ${label} تنتهي خلال ${days} يوم`,
        });
      }
    }
    if (items.length === 0) {
      return 'كل مستندات المركبات (استمارة/تأمين/فحص دوري) سارية لأكثر من 30 يوماً.';
    }
    items.sort((a, b) => a.days - b.days);
    return `مستندات تنتهي خلال 30 يوماً أو منتهية (${items.length}):\n${items
      .slice(0, 8)
      .map((i) => i.text)
      .join('\n')}${items.length > 8 ? '\n…' : ''}`;
  }

  private async revenue(tenantId: string | null): Promise<string> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const where: Prisma.InvoiceWhereInput = {
      ...tenantWhere(tenantId),
      status: 'PAID' as InvoiceStatus,
      paidAt: { gte: start },
    };
    const [count, agg] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({ where, _sum: { total: true } }),
    ]);
    if (count === 0) return 'لا توجد فواتير مسددة هذا الشهر بعد.';
    return `إيرادات هذا الشهر المسددة: ${this.fmt(Number(agg._sum.total || 0))} ر.س عبر ${count} فاتورة.`;
  }

  private async deals(tenantId: string | null): Promise<string> {
    const grouped = await prisma.deal.groupBy({
      by: ['stage'],
      where: tenantWhere(tenantId),
      _count: { id: true },
    });
    const labels: Record<string, string> = {
      LEAD: 'عملاء محتملون',
      QUALIFIED: 'مؤهلة',
      PROPOSAL: 'عرض سعر',
      NEGOTIATION: 'تفاوض',
      CLOSED_WON: 'مغلقة رابحة',
      CLOSED_LOST: 'مغلقة خاسرة',
    };
    const order = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
    const lines = order
      .map((stage) => {
        const g = grouped.find((x) => x.stage === stage);
        return g ? `• ${labels[stage]}: ${g._count.id}` : null;
      })
      .filter(Boolean)
      .join('\n');
    return lines ? `الصفقات حسب المرحلة:\n${lines}` : 'لا توجد صفقات مسجلة بعد.';
  }

  private async alerts(tenantId: string | null): Promise<string> {
    const where: Prisma.AlertWhereInput = { ...tenantWhere(tenantId), isRead: false };
    const grouped = await prisma.alert.groupBy({
      by: ['severity'],
      where,
      _count: { id: true },
    });
    const total = grouped.reduce((s, g) => s + g._count.id, 0);
    if (total === 0) return 'لا توجد تنبيهات غير مقروءة — كل شيء تحت السيطرة.';
    const sev = (key: string) => grouped.find((g) => g.severity === key)?._count.id || 0;
    return `لديك ${total} تنبيه غير مقروء: ${sev('CRITICAL')} حرجة، ${sev('WARNING')} تحذير، ${sev('INFO')} معلومة.`;
  }

  private async countIntent(msg: string, tenantId: string | null): Promise<string | null> {
    const wantsCount = /كم|عدد|كام|مقدار/.test(msg);
    if (!wantsCount) return null;
    const intents: Array<[RegExp, 'contact' | 'deal' | 'employee' | 'vehicle' | 'property' | 'unit' | 'invoice', string]> = [
      [/جهات اتصال|عملاء|العملاء/, 'contact', 'جهة اتصال'],
      [/صفقات/, 'deal', 'صفقة'],
      [/موظفين|موظفون|موظف/, 'employee', 'موظف'],
      [/مركبات|سيارات|شاحنات/, 'vehicle', 'مركبة'],
      [/عقارات/, 'property', 'عقار'],
      [/وحدات/, 'unit', 'وحدة'],
      [/فواتير/, 'invoice', 'فاتورة'],
    ];
    for (const [pattern, model, label] of intents) {
      if (!pattern.test(msg)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[model];
      const count: number = await delegate.count({ where: tenantWhere(tenantId) });
      return `لديك ${count} ${label} مسجلة في النظام.`;
    }
    return null;
  }

  private greeting(): string {
    return (
      'أهلاً بك! أنا مساعد مركز القيادة الذكي، وأجيب مباشرة من بيانات منشأتك:\n' +
      '• الفواتير المتأخرة والإيرادات\n' +
      '• استمارات وتأمين المركبات القريبة من الانتهاء\n' +
      '• عدد العملاء والصفقات والموظفين والمركبات والعقارات\n' +
      '• التنبيهات النشطة\n' +
      'مثال: «كم فاتورة متأخرة لدي؟» أو «مركبات تنتهي استماراتها»'
    );
  }
}
