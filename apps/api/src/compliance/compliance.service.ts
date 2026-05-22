import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@scc/database';

@Injectable()
export class ComplianceService {
  // ─── PDPL Consent ────────────────────────────────────────────────────
  async createConsent(tenantId: string, data: {
    subjectType: string;
    subjectId: string;
    subjectName: string;
    subjectEmail?: string;
    subjectPhone?: string;
    purpose: string;
    purposeAr?: string;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.dataSubjectConsent.create({
      data: { ...data, tenantId, granted: true, grantedAt: new Date() },
    });
  }

  async withdrawConsent(tenantId: string, consentId: string, withdrawnBy: string) {
    const consent = await prisma.dataSubjectConsent.findFirst({
      where: { id: consentId, tenantId },
    });
    if (!consent) throw new NotFoundException('الموافقة غير موجودة');

    return prisma.dataSubjectConsent.update({
      where: { id: consentId },
      data: { granted: false, withdrawnAt: new Date(), withdrawnBy },
    });
  }

  async getConsents(tenantId: string, filters?: { subjectType?: string; subjectId?: string; granted?: boolean }) {
    return prisma.dataSubjectConsent.findMany({
      where: { tenantId, ...filters },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConsentStatus(tenantId: string, subjectType: string, subjectId: string) {
    const consents = await prisma.dataSubjectConsent.findMany({
      where: { tenantId, subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
    });

    const active = consents.filter((c) => c.granted && !c.withdrawnAt);
    const withdrawn = consents.filter((c) => !c.granted || c.withdrawnAt);

    return {
      subjectType,
      subjectId,
      hasActiveConsent: active.length > 0,
      activePurposes: active.map((c) => c.purpose),
      withdrawnPurposes: withdrawn.map((c) => c.purpose),
      totalConsents: consents.length,
    };
  }

  // ─── WPS Export (Wage Protection System) ─────────────────────────────
  async exportWpsFile(tenantId: string, month: number, year: number): Promise<string> {
    const payrolls = await prisma.payroll.findMany({
      where: { tenantId, month, year },
      include: { employee: true },
    });

    if (payrolls.length === 0) {
      throw new NotFoundException('لا توجد كشوف رواتب لهذا الشهر');
    }

    // SIF (Saudi Interbank File) format for WPS
    const lines: string[] = [];

    // Header record
    const employer = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const headerDate = new Date(year, month - 1, 1);
    lines.push(
      `H${(employer?.crNumber || '').padEnd(20, ' ')}${month.toString().padStart(2, '0')}${year}${payrolls.length.toString().padStart(6, '0')}${payrolls.reduce((s, p) => s + Number(p.netSalary), 0).toFixed(2).padStart(15, '0')}`,
    );

    // Detail records
    for (const payroll of payrolls) {
      const emp = payroll.employee;
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { tenantId },
      });
      lines.push(
        `D${(emp.idNumber || '').padEnd(20, ' ')}${(emp.firstName + ' ' + emp.lastName).substring(0, 50).padEnd(50, ' ')}${(bankAccount?.iban || '').padEnd(34, ' ')}${Number(payroll.netSalary).toFixed(2).padStart(15, '0')}${(emp.employeeCode || '').padEnd(20, ' ')}`,
      );
    }

    // Footer record
    lines.push(`F${payrolls.length.toString().padStart(6, '0')}${payrolls.reduce((s, p) => s + Number(p.netSalary), 0).toFixed(2).padStart(15, '0')}`);

    return lines.join('\n');
  }

  // ─── Qiwa Mock Integration ───────────────────────────────────────────
  async syncQiwaContracts(tenantId: string) {
    const employees = await prisma.employee.findMany({ where: { tenantId } });

    return {
      success: true,
      message: 'تمت مزامنة عقود Qiwa (وضع التجربة)',
      synced: employees.length,
      contracts: employees.map((e) => ({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        idNumber: e.idNumber,
        contractStatus: 'ACTIVE',
        qiwaStatus: 'VERIFIED',
        mock: true,
      })),
    };
  }

  // ─── Compliance Report ───────────────────────────────────────────────
  async getComplianceReport(tenantId: string) {
    const [
      auditLogCount,
      consentCount,
      activeConsentCount,
      invoiceCount,
      zatcaCredential,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.dataSubjectConsent.count({ where: { tenantId } }),
      prisma.dataSubjectConsent.count({ where: { tenantId, granted: true, withdrawnAt: null } }),
      prisma.invoice.count({ where: { tenantId } }),
      prisma.zatcaCredential.findUnique({ where: { tenantId } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      tenantId,
      summary: {
        auditLogs: auditLogCount,
        dataSubjectConsents: consentCount,
        activeConsents: activeConsentCount,
        totalInvoices: invoiceCount,
      },
      zatcaStatus: zatcaCredential?.status || 'NOT_CONFIGURED',
      pdplStatus: consentCount > 0 ? 'COMPLIANT' : 'PENDING',
      dataHosting: {
        location: 'KSA',
        compliant: true,
        note: 'البيانات تُحفظ في خوادم محلية (مطلوب تأكيد الاستضافة الفعلية)',
      },
      recommendations: [
        consentCount === 0 ? 'قم بتفعيل موافقات PDPL للموظفين والعملاء' : null,
        !zatcaCredential ? 'أكمل إعداد ZATCA للفوترة الإلكترونية' : null,
        auditLogCount < 100 ? 'سجل العمليات قليل — تأكد من تفعيل Audit Logs' : null,
      ].filter(Boolean),
    };
  }
}
