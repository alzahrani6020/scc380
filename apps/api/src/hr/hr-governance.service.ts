import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { createHash } from 'node:crypto';

export const GOVERNANCE_CATEGORIES = [
  'VIOLATIONS', 'INVESTIGATIONS', 'EVIDENCE', 'DISCIPLINE', 'CONFLICTS',
  'CLAIMS', 'LEGAL', 'OFFBOARDING', 'COMPLIANCE',
] as const;

export const GOVERNANCE_WORKFLOWS: Record<string, { code: string; label: string }[]> = {
  VIOLATIONS: [
    { code: 'REPORT_DETAIL', label: 'تفاصيل البلاغ' },
    { code: 'EMPLOYEE_RESPONSE', label: 'إفادة الموظف' },
    { code: 'REVIEW_FINDING', label: 'نتيجة مراجعة البلاغ' },
  ],
  INVESTIGATIONS: [
    { code: 'INVESTIGATOR_ASSIGNED', label: 'تكليف المحقق' },
    { code: 'INTERVIEW', label: 'محضر الاستماع' },
    { code: 'FACT_FINDING', label: 'نتيجة التحقيق' },
  ],
  EVIDENCE: [
    { code: 'EVIDENCE_REVIEW', label: 'فحص الدليل' },
    { code: 'CHAIN_OF_CUSTODY', label: 'توثيق نقل الحيازة' },
  ],
  DISCIPLINE: [
    { code: 'NOTICE_PROPOSED', label: 'مسودة إشعار أو إجراء' },
    { code: 'EMPLOYEE_RESPONSE', label: 'رد الموظف' },
    { code: 'FINAL_REVIEW', label: 'مراجعة مستقلة للإجراء' },
    { code: 'APPEAL_SUBMITTED', label: 'تظلم الموظف' },
    { code: 'APPEAL_REVIEWED', label: 'مراجعة التظلم' },
  ],
  CONFLICTS: [
    { code: 'DISCLOSURE', label: 'إفصاح عن تعارض مصالح' },
    { code: 'MITIGATION_PLAN', label: 'خطة معالجة التعارض' },
    { code: 'MITIGATION_REVIEW', label: 'التحقق من المعالجة' },
  ],
  CLAIMS: [
    { code: 'CLAIM_PROPOSED', label: 'تسجيل مطالبة غير معتمدة' },
    { code: 'EMPLOYEE_RESPONSE', label: 'رد صاحب العلاقة' },
    { code: 'CLAIM_REVIEWED', label: 'مراجعة المطالبة' },
    { code: 'SETTLEMENT_OFFER', label: 'عرض تسوية' },
    { code: 'SETTLEMENT_ACCEPTANCE', label: 'توثيق قبول العرض' },
  ],
  LEGAL: [
    { code: 'CASE_REFERENCE', label: 'مرجع القضية' },
    { code: 'HEARING', label: 'جلسة أو موعد قضائي' },
    { code: 'JUDGMENT_RECORDED', label: 'تسجيل نتيجة قضائية موثقة' },
  ],
  OFFBOARDING: [
    { code: 'HANDOVER', label: 'محضر تسليم الأعمال' },
    { code: 'ASSET_RETURN_CHECK', label: 'مطابقة العهد مع السجل' },
    { code: 'ACCESS_REVOKED_CONFIRMED', label: 'إثبات مراجعة إلغاء الوصول' },
  ],
  COMPLIANCE: [
    { code: 'CONTROL_FINDING', label: 'ملاحظة رقابية' },
    { code: 'CORRECTIVE_ACTION', label: 'إجراء تصحيحي' },
    { code: 'CONTROL_VERIFIED', label: 'التحقق من الإغلاق' },
  ],
};

export function assertGovernanceAction(
  category: string, code: string, actor: string, history: { action: string; actorUserId: string }[],
) {
  if (!GOVERNANCE_WORKFLOWS[category]?.some(item => item.code === code)) {
    throw new BadRequestException('Action is not available for this governance workspace');
  }
  const latest = (action: string) => [...history].reverse().find(event => event.action === action);
  if (category === 'DISCIPLINE' && code === 'FINAL_REVIEW') {
    const proposed = latest('NOTICE_PROPOSED');
    if (!proposed || !latest('EMPLOYEE_RESPONSE')) {
      throw new ConflictException('Proposed action and employee response are required before review');
    }
    if (proposed.actorUserId === actor) throw new ConflictException('Independent reviewer required');
  }
  if (category === 'DISCIPLINE' && code === 'APPEAL_REVIEWED') {
    const appeal = latest('APPEAL_SUBMITTED');
    if (!appeal) throw new ConflictException('No submitted appeal');
    if (appeal.actorUserId === actor) throw new ConflictException('Appeal must be independently reviewed');
  }
  if (category === 'CLAIMS' && code === 'CLAIM_REVIEWED') {
    const claim = latest('CLAIM_PROPOSED');
    if (!claim || !latest('EMPLOYEE_RESPONSE')) {
      throw new ConflictException('Claim and respondent reply must precede review');
    }
    if (claim.actorUserId === actor) throw new ConflictException('Independent claim review required');
  }
  if (category === 'CONFLICTS' && code === 'MITIGATION_REVIEW' && !latest('MITIGATION_PLAN')) {
    throw new ConflictException('Mitigation plan required before review');
  }
  if (category === 'COMPLIANCE' && code === 'CONTROL_VERIFIED' && !latest('CORRECTIVE_ACTION')) {
    throw new ConflictException('Corrective action required before verification');
  }
  if (category === 'INVESTIGATIONS' && code === 'FACT_FINDING' && !latest('INTERVIEW')) {
    throw new ConflictException('Interview record required before investigation findings');
  }
  if (category === 'CLAIMS' && code === 'SETTLEMENT_ACCEPTANCE' && !latest('SETTLEMENT_OFFER')) {
    throw new ConflictException('Settlement offer required before accepting');
  }
}

export function assertGovernanceClosure(
  category: string, history: { action: string; createdAt: Date }[],
) {
  const lastIndex = (action: string) => history.reduce((index, row, i) => row.action === action ? i : index, -1);
  if (category === 'DISCIPLINE' && lastIndex('APPEAL_SUBMITTED') > lastIndex('APPEAL_REVIEWED')) {
    throw new ConflictException('An unresolved employee appeal prevents case closure');
  }
  if (category === 'CLAIMS' && lastIndex('CLAIM_PROPOSED') > lastIndex('CLAIM_REVIEWED')) {
    throw new ConflictException('A pending claim review prevents case closure');
  }
}

@Injectable()
export class HrGovernanceService {
  async list(req: any, query: { category?: string; status?: string; employeeId?: string }) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.category) {
      if (!GOVERNANCE_CATEGORIES.includes(query.category as any)) throw new BadRequestException('Invalid governance category');
      where.category = query.category;
    }
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    const data = await prisma.hrGovernanceCase.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    return { data, count: data.length };
  }

  async findOne(req: any, id: string) {
    const record = await prisma.hrGovernanceCase.findFirst({
      where: { ...tenantWhere(req.user?.tenantId), id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!record) throw new NotFoundException('Governance case not found');
    return record;
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    if (!GOVERNANCE_CATEGORIES.includes(dto.category)) throw new BadRequestException('Invalid governance category');
    const employee = await prisma.employee.findFirst({
      where: { ...tenantWhere(tenantId), id: dto.employeeId }, select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found in this organization');
    if (dto.contractId) {
      const contract = await prisma.employeeContract.findFirst({
        where: { ...tenantWhere(tenantId), id: dto.contractId, employeeId: dto.employeeId }, select: { id: true },
      });
      if (!contract) throw new BadRequestException('Contract does not belong to the employee');
    }
    return prisma.hrGovernanceCase.create({
      data: {
        tenantId, employeeId: dto.employeeId, contractId: dto.contractId || null,
        category: dto.category, title: dto.title.trim(), description: dto.description.trim(),
        priority: dto.priority || 'NORMAL', createdById: actor,
        events: { create: { tenantId, actorUserId: actor, action: 'CREATED', details: 'Case opened for review; no allegation has been substantiated' } },
      },
      include: { events: true },
    });
  }

  async addNote(req: any, id: string, details: string) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({
        where: { ...tenantWhere(tenantId), id }, select: { id: true, status: true },
      });
      if (!record) throw new NotFoundException('Governance case not found');
      if (record.status === 'CLOSED') throw new ConflictException('Closed cases are read only');
      const updated = await tx.hrGovernanceCase.updateMany({
        where: { ...tenantWhere(tenantId), id, status: { not: 'CLOSED' } },
        data: { updatedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Case closed during note submission');
      await tx.hrGovernanceEvent.create({ data: {
        tenantId, caseId: id, actorUserId: actor, action: 'NOTE', details: details.trim(),
      } });
      return tx.hrGovernanceCase.findFirstOrThrow({ where: { ...tenantWhere(tenantId), id }, include: { events: true } });
    }, { isolationLevel: 'Serializable' });
  }

  async transition(req: any, id: string, status: string, resolution?: string) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    const transitions: Record<string, string[]> = {
      OPEN: ['IN_REVIEW', 'CLOSED'],
      IN_REVIEW: ['RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_REVIEW'],
      CLOSED: [],
    };
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({ where: { ...tenantWhere(tenantId), id } });
      if (!record) throw new NotFoundException('Governance case not found');
      if (!transitions[record.status]?.includes(status)) throw new ConflictException('Invalid case status transition');
      if (status === 'CLOSED') {
        const history = await tx.hrGovernanceEvent.findMany({
          where: { tenantId, caseId: id }, orderBy: { createdAt: 'asc' },
          select: { action: true, createdAt: true },
        });
        assertGovernanceClosure(record.category, history);
      }
      if ((status === 'RESOLVED' || status === 'CLOSED') && !resolution?.trim()) {
        throw new BadRequestException('Closure or resolution rationale is required');
      }
      const changed = await tx.hrGovernanceCase.updateMany({
        where: { ...tenantWhere(tenantId), id, status: record.status },
        data: {
          status,
          resolution: resolution?.trim() || record.resolution,
          closedById: status === 'CLOSED' ? actor : null,
          closedAt: status === 'CLOSED' ? new Date() : null,
        },
      });
      if (changed.count !== 1) throw new ConflictException('Case was changed concurrently');
      await tx.hrGovernanceEvent.create({ data: {
        tenantId, caseId: id, actorUserId: actor, action: 'STATUS_CHANGED',
        details: record.status + ' -> ' + status + (resolution ? ': ' + resolution.trim() : ''),
      } });
      return tx.hrGovernanceCase.findFirstOrThrow({
        where: { ...tenantWhere(tenantId), id }, include: { events: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async addEvidence(req: any, id: string, dto: {
    fileName: string; mimeType: string; contentBase64: string; description?: string;
  }) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(dto.mimeType)) throw new BadRequestException('Unsupported evidence MIME type');
    const source = dto.contentBase64 || '';
    if (source.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(source) || source.length % 4 !== 0) {
      throw new BadRequestException('Invalid evidence encoding');
    }
    const content = Buffer.from(source, 'base64');
    if (!content.length || content.length > 5*1024*1024 || content.toString('base64') !== source) {
      throw new BadRequestException('Evidence size or encoding invalid');
    }
    const signatureOk = dto.mimeType === 'application/pdf'
      ? content.subarray(0,5).toString('ascii') === '%PDF-'
      : dto.mimeType === 'image/jpeg'
        ? content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
        : content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (!signatureOk) throw new BadRequestException('Evidence file signature does not match MIME type');
    const checksumSha256 = createHash('sha256').update(content).digest('hex');
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({where:{...tenantWhere(tenantId),id}});
      if (!record) throw new NotFoundException('Governance case not found');
      if (record.status === 'CLOSED') throw new ConflictException('Closed cases are read only');
      const updated = await tx.hrGovernanceCase.updateMany({
        where: { ...tenantWhere(tenantId), id, status: { not: 'CLOSED' } },
        data: { updatedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Case closed during evidence submission');
      const evidence = await tx.hrGovernanceEvidence.create({
        data: {
          tenantId, caseId:id, fileName:dto.fileName.trim(), mimeType:dto.mimeType,
          content, sizeBytes:content.length, checksumSha256,
          uploadedById:actor, description:dto.description?.trim()||null,
        },
        select: {id:true,caseId:true,fileName:true,mimeType:true,sizeBytes:true,checksumSha256:true,description:true,uploadedById:true,createdAt:true},
      });
      await tx.hrGovernanceEvent.create({data:{
        tenantId,caseId:id,actorUserId:actor,action:'EVIDENCE_ADDED',
        details:'Evidence '+evidence.id+' registered (SHA-256 '+checksumSha256+')',
      }});
      return evidence;
    }, { isolationLevel: 'Serializable' });
  }

  async relatedWorkspaces(req: any, id: string) {
    const tenantId=req.user?.tenantId;
    const current=await prisma.hrGovernanceCase.findFirst({
      where:{...tenantWhere(tenantId),id},select:{employeeId:true,contractId:true},
    });
    if(!current)throw new NotFoundException('Governance case not found');
    const where={...tenantWhere(tenantId),employeeId:current.employeeId};
    const [employee,contracts,custody,settlements,lifecycle]=await Promise.all([
      prisma.employee.findFirst({
        where:{...tenantWhere(tenantId),id:current.employeeId},
        select:{id:true,employeeCode:true,firstName:true,lastName:true,status:true,terminationDate:true},
      }),
      prisma.employeeContract.findMany({
        where,select:{id:true,contractNumber:true,status:true,startDate:true,endDate:true},
        orderBy:{startDate:'desc'},take:20,
      }),
      prisma.assetCustodyAssignment.findMany({
        where,select:{id:true,status:true,asset:{select:{id:true,name:true,code:true}}},
        orderBy:{assignedAt:'desc'},take:50,
      }),
      prisma.endServiceSettlement.findMany({
        where,select:{id:true,status:true,lastWorkingDate:true,netSettlement:true},
        orderBy:{createdAt:'desc'},take:20,
      }),
      prisma.hrLifecycleCase.findMany({
        where,select:{id:true,type:true,status:true,targetDate:true},
        orderBy:{createdAt:'desc'},take:20,
      }),
    ]);
    return {employee,linkedContractId:current.contractId,contracts,custody,settlements,lifecycle};
  }

  async workflowCatalog() { return GOVERNANCE_WORKFLOWS; }

  async addWorkflowAction(req: any, id: string, dto: {
    code: string; narrative: string; amount?: number; dueDate?: string;
  }) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    const narrative = typeof dto.narrative === 'string' ? dto.narrative.trim() : '';
    if (narrative.length < 10 || narrative.length > 4000) {
      throw new BadRequestException('Action narrative must contain between 10 and 4000 characters');
    }
    if (dto.amount !== undefined &&
      (!Number.isFinite(dto.amount) || dto.amount < 0 || dto.amount > 1_000_000_000)) {
      throw new BadRequestException('Invalid reference amount');
    }
    if (dto.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dto.dueDate) ||
      Number.isNaN(Date.parse(dto.dueDate)))) {
      throw new BadRequestException('Invalid reference date');
    }
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({
        where: { ...tenantWhere(tenantId), id },
        select: { id: true, category: true, status: true },
      });
      if (!record) throw new NotFoundException('Governance case not found');
      if (record.status === 'CLOSED') throw new ConflictException('Closed cases are read only');
      const history = await tx.hrGovernanceEvent.findMany({
        where: { tenantId, caseId: id }, orderBy: { createdAt: 'asc' },
        select: { action: true, actorUserId: true },
      });
      assertGovernanceAction(record.category, dto.code, actor, history);
      const updated = await tx.hrGovernanceCase.updateMany({
        where: { ...tenantWhere(tenantId), id, status: { not: 'CLOSED' } },
        data: { updatedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException('Case closed during action submission');
      await tx.hrGovernanceEvent.create({
        data: { tenantId, caseId: id, actorUserId: actor, action: dto.code,
          details: JSON.stringify({ narrative, amount: dto.amount ?? null, dueDate: dto.dueDate ?? null }) },
      });
      return tx.hrGovernanceCase.findFirstOrThrow({
        where: { ...tenantWhere(tenantId), id }, include: { events: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async listEvidence(req: any, id: string) {
    const tenantId = req.user?.tenantId;
    const record = await prisma.hrGovernanceCase.findFirst({where:{...tenantWhere(tenantId),id},select:{id:true}});
    if (!record) throw new NotFoundException('Governance case not found');
    return prisma.hrGovernanceEvidence.findMany({
      where:{tenantId,caseId:id},
      select:{id:true,caseId:true,fileName:true,mimeType:true,sizeBytes:true,checksumSha256:true,description:true,uploadedById:true,createdAt:true},
      orderBy:{createdAt:'asc'},
    });
  }

  async getEvidence(req: any, id: string, evidenceId: string) {
    const tenantId=req.user?.tenantId;
    const evidence=await prisma.hrGovernanceEvidence.findFirst({
      where:{tenantId,caseId:id,id:evidenceId,case:{tenantId}},
    });
    if(!evidence)throw new NotFoundException('Evidence not found');
    return evidence;
  }

}
