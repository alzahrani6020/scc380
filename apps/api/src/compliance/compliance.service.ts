import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';

type AssuranceStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'NOT_CONFIGURED'
  | 'NOT_VERIFIED'
  | 'MOCK';

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
    const payrollCount = await prisma.payroll.count({
      where: { tenantId, month, year },
    });

    if (payrollCount === 0) {
      throw new NotFoundException('لا توجد كشوف رواتب لهذا الشهر');
    }

    // Safety gate: the current Employee schema has no per-employee payroll
    // IBAN. Generating a SIF with the tenant/company account would be
    // materially misleading, so production export is blocked until that
    // data model and an official-format conformance test are implemented.
    throw new BadRequestException(
      'WPS_NOT_VERIFIED: التصدير متوقف لحين حفظ IBAN مستقل لكل موظف والتحقق من مطابقة صيغة SIF',
    );
  }

  // ─── Qiwa Mock Integration ───────────────────────────────────────────
  async syncQiwaContracts(tenantId: string) {
    const employees = await prisma.employee.findMany({ where: { tenantId } });

    return {
      success: true,
      mode: 'MOCK',
      connectedToQiwa: false,
      message: 'محاكاة محلية فقط — لم يتم الاتصال بمنصة قوى',
      synced: employees.length,
      contracts: employees.map((e) => ({
        employeeId: e.id,
        name: `${e.firstName} ${e.lastName}`,
        idNumber: e.idNumber,
        contractStatus: 'ACTIVE',
        qiwaStatus: 'MOCK_VERIFIED',
        mock: true,
      })),
    };
  }

  private async getSnapshot(tenantId: string) {
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

    const pdplStatus: AssuranceStatus =
      activeConsentCount > 0 ? 'PARTIAL' : 'NOT_CONFIGURED';

    return {
      auditLogCount,
      consentCount,
      activeConsentCount,
      invoiceCount,
      zatcaCredential,
      statuses: {
        pdpl: pdplStatus,
        nca: 'NOT_VERIFIED' as AssuranceStatus,
        qiwa: 'MOCK' as AssuranceStatus,
        wps: 'NOT_VERIFIED' as AssuranceStatus,
        dga: 'NOT_VERIFIED' as AssuranceStatus,
        dataHosting: 'NOT_VERIFIED' as AssuranceStatus,
        zatcaAssurance: 'NOT_VERIFIED' as AssuranceStatus,
      },
    };
  }

  // ─── Evidence / Controls / Findings core ─────────────────────────────
  async getEvidence(tenantId: string) {
    const s = await this.getSnapshot(tenantId);

    return [
      {
        id: 'AUDIT_LOG_COUNT',
        controlId: 'AUDIT-001',
        source: 'database:audit_logs',
        sourceType: 'AUTOMATED',
        capturedAt: new Date().toISOString(),
        value: s.auditLogCount,
        verified: true,
      },
      {
        id: 'PDPL_ACTIVE_CONSENTS',
        controlId: 'PDPL-001',
        source: 'database:data_subject_consents',
        sourceType: 'AUTOMATED',
        capturedAt: new Date().toISOString(),
        value: s.activeConsentCount,
        verified: true,
        note: 'وجود الموافقات دليل جزئي فقط ولا يثبت الامتثال الكامل لـ PDPL',
      },
      {
        id: 'ZATCA_CREDENTIAL_STATE',
        controlId: 'ZATCA-001',
        source: 'database:zatca_credentials',
        sourceType: 'AUTOMATED',
        capturedAt: new Date().toISOString(),
        value: s.zatcaCredential
          ? {
              status: s.zatcaCredential.status,
              environment: s.zatcaCredential.environment,
              expiresAt: s.zatcaCredential.expiresAt,
            }
          : null,
        verified: Boolean(s.zatcaCredential),
        note: 'يثبت حالة إعداد التكامل فقط، وليس المطابقة التنظيمية الكاملة',
      },
      {
        id: 'DATA_RESIDENCY',
        controlId: 'DATA-RESIDENCY-001',
        source: null,
        sourceType: 'NONE',
        capturedAt: new Date().toISOString(),
        value: null,
        verified: false,
        note: 'لم يتم ربط مصدر موثوق يثبت موقع الاستضافة الفعلي',
      },
    ];
  }

  async getControls(tenantId: string) {
    const s = await this.getSnapshot(tenantId);

    return [
      {
        id: 'PDPL-001',
        framework: 'PDPL',
        title: 'إدارة موافقات أصحاب البيانات',
        status: s.statuses.pdpl,
        evidenceIds: ['PDPL_ACTIVE_CONSENTS'],
        assurance: 'PARTIAL',
      },
      {
        id: 'AUDIT-001',
        framework: 'INTERNAL',
        title: 'سجل العمليات',
        status: s.auditLogCount > 0 ? 'PARTIAL' : 'NOT_CONFIGURED',
        evidenceIds: ['AUDIT_LOG_COUNT'],
        assurance: s.auditLogCount > 0 ? 'PARTIAL' : 'NOT_CONFIGURED',
      },
      {
        id: 'ZATCA-001',
        framework: 'ZATCA',
        title: 'إعداد تكامل الفوترة الإلكترونية',
        status: s.zatcaCredential?.status || 'NOT_CONFIGURED',
        evidenceIds: ['ZATCA_CREDENTIAL_STATE'],
        assurance: s.statuses.zatcaAssurance,
      },
      {
        id: 'DATA-RESIDENCY-001',
        framework: 'DATA_RESIDENCY',
        title: 'التحقق من موقع استضافة البيانات',
        status: s.statuses.dataHosting,
        evidenceIds: ['DATA_RESIDENCY'],
        assurance: 'NOT_VERIFIED',
      },
      {
        id: 'QIWA-001',
        framework: 'MHRSD_QIWA',
        title: 'تكامل عقود قوى',
        status: s.statuses.qiwa,
        evidenceIds: [],
        assurance: 'MOCK',
      },
      {
        id: 'WPS-001',
        framework: 'MHRSD_WPS',
        title: 'ملف حماية الأجور',
        status: s.statuses.wps,
        evidenceIds: [],
        assurance: 'NOT_VERIFIED',
      },
      {
        id: 'NCA-001',
        framework: 'NCA',
        title: 'ضوابط الأمن السيبراني',
        status: s.statuses.nca,
        evidenceIds: [],
        assurance: 'NOT_VERIFIED',
      },
      {
        id: 'DGA-001',
        framework: 'DGA',
        title: 'متطلبات الحكومة الرقمية',
        status: s.statuses.dga,
        evidenceIds: [],
        assurance: 'NOT_VERIFIED',
      },
    ];
  }

  async getFindings(tenantId: string) {
    const s = await this.getSnapshot(tenantId);

    const findings = [
      {
        id: 'F-PDPL-SCOPE',
        severity: 'HIGH',
        framework: 'PDPL',
        status: 'OPEN',
        title: 'لا يوجد أساس كافٍ لإعلان الامتثال الكامل لـ PDPL',
        reason:
          s.activeConsentCount > 0
            ? 'الموافقات موجودة، لكن بقية ضوابط PDPL لم يتم إثباتها'
            : 'لا توجد موافقات نشطة، وبقية ضوابط PDPL لم يتم إثباتها',
      },
      {
        id: 'F-DATA-RESIDENCY',
        severity: 'HIGH',
        framework: 'DATA_RESIDENCY',
        status: 'OPEN',
        title: 'موقع استضافة البيانات غير متحقق',
        reason: 'لا يوجد مصدر بنية تحتية موثوق مرتبط بلوحة الامتثال',
      },
      {
        id: 'F-QIWA-MOCK',
        severity: 'MEDIUM',
        framework: 'MHRSD_QIWA',
        status: 'OPEN',
        title: 'Qiwa يعمل في وضع المحاكاة فقط',
        reason: 'لا يوجد اتصال حكومي حي مثبت',
      },
      {
        id: 'F-WPS-UNVERIFIED',
        severity: 'HIGH',
        framework: 'MHRSD_WPS',
        status: 'OPEN',
        title: 'WPS غير متحقق إنتاجيًا',
        reason: 'نموذج الموظف الحالي لا يحفظ IBAN مستقلًا لكل موظف',
      },
      {
        id: 'F-NCA-UNVERIFIED',
        severity: 'MEDIUM',
        framework: 'NCA',
        status: 'OPEN',
        title: 'حالة NCA غير متحققة',
        reason: 'لا توجد اختبارات ضوابط أو أدلة مرتبطة',
      },
      {
        id: 'F-DGA-UNVERIFIED',
        severity: 'LOW',
        framework: 'DGA',
        status: 'OPEN',
        title: 'حالة DGA غير متحققة',
        reason: 'لا توجد اختبارات ضوابط أو أدلة مرتبطة',
      },
    ];

    if (s.zatcaCredential) {
      findings.push({
        id: 'F-ZATCA-ASSURANCE',
        severity: 'HIGH',
        framework: 'ZATCA',
        status: 'OPEN',
        title: 'إعداد ZATCA موجود لكن المطابقة الكاملة غير متحققة',
        reason: 'حالة الشهادة لا تكفي لإثبات مطابقة XML/QR والتوقيع لكل متطلبات الإنتاج',
      });
    }

    return findings;
  }

  // ─── Compliance Report ───────────────────────────────────────────────
  async getComplianceReport(tenantId: string) {
    const s = await this.getSnapshot(tenantId);

    return {
      generatedAt: new Date().toISOString(),
      tenantId,
      summary: {
        auditLogs: s.auditLogCount,
        dataSubjectConsents: s.consentCount,
        activeConsents: s.activeConsentCount,
        totalInvoices: s.invoiceCount,
      },
      zatcaStatus: s.zatcaCredential?.status || 'NOT_CONFIGURED',
      zatcaAssurance: s.statuses.zatcaAssurance,
      pdplStatus: s.statuses.pdpl,
      ncaStatus: s.statuses.nca,
      qiwaStatus: s.statuses.qiwa,
      wpsStatus: s.statuses.wps,
      dgaStatus: s.statuses.dga,
      dataHosting: {
        location: 'UNKNOWN',
        compliant: false,
        verified: false,
        status: s.statuses.dataHosting,
        note: 'موقع استضافة البيانات غير متحقق حاليًا من مصدر بنية تحتية موثوق',
      },
      recommendations: [
        s.activeConsentCount === 0
          ? 'ابدأ بتسجيل موافقات أصحاب البيانات؛ ولا تعتبر ذلك وحده امتثالًا كاملًا لـ PDPL'
          : 'موافقات PDPL موجودة جزئيًا؛ يلزم إثبات بقية الضوابط قبل إعلان الامتثال',
        !s.zatcaCredential
          ? 'أكمل إعداد ZATCA للفوترة الإلكترونية'
          : 'تحقق من مطابقة ZATCA الفنية قبل اعتبار التكامل متوافقًا إنتاجيًا',
        s.auditLogCount < 100 ? 'راجع تغطية Audit Logs؛ العدد الحالي منخفض' : null,
        'اربط مصدر البنية التحتية قبل تحديد موقع استضافة البيانات',
        'Qiwa يعمل حاليًا في وضع المحاكاة فقط',
        'تحقق من WPS ببيانات بنكية مستقلة لكل موظف قبل استخدامه إنتاجيًا',
      ].filter(Boolean),
    };
  }
}
