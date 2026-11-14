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
    { code: 'CASE_DISPOSITION', label: 'محضر مآل القضية أو إغلاقها' },
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
  if (category === 'INVESTIGATIONS' && code === 'INVESTIGATOR_ASSIGNED') {
    throw new BadRequestException('Investigator assignment requires a verified tenant user');
  }
  if (['EMPLOYEE_RESPONSE', 'APPEAL_SUBMITTED'].includes(code)) {
    throw new BadRequestException('Employee statements and appeals require authenticated employee self-service');
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
    if (latest('FINAL_REVIEW')?.actorUserId === actor) {
      throw new ConflictException('Appeal reviewer must differ from the original decision reviewer');
    }
  }
  if (category === 'VIOLATIONS' && code === 'REVIEW_FINDING') {
    if (!latest('REPORT_DETAIL')) throw new ConflictException('Reported issue required before review');
    if (latest('REPORT_DETAIL')?.actorUserId === actor) {
      throw new ConflictException('Independent reviewer required for reported violations');
    }
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
  if (category === 'CONFLICTS' && code === 'MITIGATION_REVIEW' &&
      latest('MITIGATION_PLAN')?.actorUserId === actor) {
    throw new ConflictException('Independent reviewer required for conflict mitigation');
  }
  if (category === 'COMPLIANCE' && code === 'CONTROL_VERIFIED' && !latest('CORRECTIVE_ACTION')) {
    throw new ConflictException('Corrective action required before verification');
  }
  if (category === 'COMPLIANCE' && code === 'CONTROL_VERIFIED' &&
      latest('CORRECTIVE_ACTION')?.actorUserId === actor) {
    throw new ConflictException('Independent verification required for compliance controls');
  }
  if (category === 'INVESTIGATIONS' && code === 'FACT_FINDING' && !latest('INTERVIEW')) {
    throw new ConflictException('Interview record required before investigation findings');
  }
  if (category === 'CLAIMS' && code === 'SETTLEMENT_OFFER' && !latest('CLAIM_REVIEWED')) {
    throw new ConflictException('Independent claim review required before settlement offer');
  }
  if (category === 'CLAIMS' && code === 'SETTLEMENT_ACCEPTANCE') {
    throw new BadRequestException('Settlement acceptance is restricted to authenticated employee self-service');
  }
}

export function assertGovernanceClosure(
  category: string, history: { action: string; createdAt: Date }[],
) {
  const lastIndex = (action: string) => history.reduce((index, row, i) => row.action === action ? i : index, -1);
  const mandatory: Record<string,string[]> = {
    VIOLATIONS:['REPORT_DETAIL','REVIEW_FINDING'],
    INVESTIGATIONS:['INVESTIGATOR_ASSIGNED','INTERVIEW','FACT_FINDING'],
    EVIDENCE:['EVIDENCE_REVIEW'],
    CONFLICTS:['DISCLOSURE','MITIGATION_PLAN','MITIGATION_REVIEW'],
    LEGAL:['CASE_REFERENCE'],
    COMPLIANCE:['CONTROL_FINDING','CORRECTIVE_ACTION','CONTROL_VERIFIED'],
  };
  for (const required of mandatory[category] || []) {
    if (lastIndex(required)<0) throw new ConflictException('Required governance action missing: '+required);
  }
  if (category==='LEGAL' && lastIndex('CASE_DISPOSITION')<0 && lastIndex('JUDGMENT_RECORDED')<0) {
    throw new ConflictException('Legal case outcome must be documented before closure');
  }
  if (category === 'DISCIPLINE' && lastIndex('NOTICE_PROPOSED') >= 0 &&
    lastIndex('FINAL_REVIEW') < lastIndex('NOTICE_PROPOSED')) {
    throw new ConflictException('Proposed disciplinary notice requires independent final review before closure');
  }
  if (category === 'DISCIPLINE' && lastIndex('APPEAL_SUBMITTED') > lastIndex('APPEAL_REVIEWED')) {
    throw new ConflictException('An unresolved employee appeal prevents case closure');
  }
  if (category === 'OFFBOARDING') {
    for (const required of ['HANDOVER', 'ASSET_RETURN_CHECK', 'ACCESS_REVOKED_CONFIRMED']) {
      if (lastIndex(required) < 0) throw new ConflictException('Offboarding task missing: ' + required);
    }
  }
  if (category === 'CLAIMS' && lastIndex('CLAIM_PROPOSED') > lastIndex('CLAIM_REVIEWED')) {
    throw new ConflictException('A pending claim review prevents case closure');
  }
}

@Injectable()
export class HrGovernanceService {
  async list(req: any, query: {
    category?: string; status?: string; employeeId?: string; search?: string; page?: string | number; limit?: string | number;
  }) {
    const tenantId=req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.category) {
      if (!GOVERNANCE_CATEGORIES.includes(query.category as any)) {
        throw new BadRequestException('Invalid governance category');
      }
      where.category = query.category;
    }
    if (query.status) {
      if (!['OPEN','IN_REVIEW','RESOLVED','CLOSED'].includes(query.status)) {
        throw new BadRequestException('Invalid governance status');
      }
      where.status = query.status;
    }
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.search !== undefined) {
      if (typeof query.search !== 'string' || query.search.length > 100) {
        throw new BadRequestException('Search term must be at most 100 characters');
      }
      const text=query.search.trim();
      if (text) {
        where.OR=[
          { title: { contains: text, mode: 'insensitive' } },
          { description: { contains: text, mode: 'insensitive' } },
        ];
      }
    }
    const page=query.page === undefined ? 1 : Number(query.page);
    const limit=query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(page) || page < 1 || page > 100000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid pagination');
    }
    const [data,count] = await Promise.all([
      prisma.hrGovernanceCase.findMany({
        where, orderBy: [{ createdAt:'desc' }, { id:'desc' }],
        skip: (page-1)*limit, take: limit,
        include: { events: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.hrGovernanceCase.count({ where }),
    ]);
    return { data, count, page, limit, totalPages: Math.ceil(count/limit) };
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
        if (record.category === 'EVIDENCE') {
          const evidenceCount = await tx.hrGovernanceEvidence.count({ where: { tenantId, caseId: id } });
          if (!evidenceCount) throw new ConflictException('Evidence workspace closure requires an uploaded original file');
        }
        if (record.category === 'OFFBOARDING') {
          const completedLifecycle = await tx.hrLifecycleCase.findFirst({
            where: { tenantId, employeeId: record.employeeId, type: 'OFFBOARDING', status: 'COMPLETED' },
            select: { id: true },
          });
          if (!completedLifecycle) throw new ConflictException('Completed HR offboarding lifecycle is required before governance closure');
          const custody = await tx.assetCustodyAssignment.count({
            where: { tenantId, employeeId: record.employeeId, status: 'ACTIVE' },
          });
          if (custody > 0) throw new ConflictException('Active custody blocks administrative offboarding closure');
          const employee = await tx.employee.findFirst({
            where: { tenantId, id: record.employeeId }, select: { userId: true },
          });
          if (employee?.userId) {
            const [user, activeSessions] = await Promise.all([
              tx.user.findFirst({ where: { tenantId, id: employee.userId }, select: { status: true } }),
              tx.session.count({ where: { userId: employee.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
            ]);
            if (user?.status === 'ACTIVE' || activeSessions > 0) {
              throw new ConflictException('Active employee access blocks offboarding case closure');
            }
          }
        }
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

  private async selfEmployee(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Authenticated employee required');
    const employee = await prisma.employee.findFirst({
      where: { ...tenantWhere(tenantId), userId }, select: { id: true },
    });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return { tenantId, userId, employeeId: employee.id };
  }

  async selfCases(req: any) {
    const { tenantId, employeeId } = await this.selfEmployee(req);
    return prisma.hrGovernanceCase.findMany({
      where: {
        tenantId, employeeId, category: { in: ['DISCIPLINE', 'CLAIMS'] },
        events: { some: { action: { in: ['NOTICE_PROPOSED', 'CLAIM_PROPOSED'] } } },
      },
      select: {
        id: true, category: true, status: true, title: true, createdAt: true,
        events: {
          where: { action: { in: [
            'NOTICE_PROPOSED', 'CLAIM_PROPOSED', 'FINAL_REVIEW', 'APPEAL_REVIEWED',
            'EMPLOYEE_RESPONSE', 'APPEAL_SUBMITTED', 'SETTLEMENT_OFFER', 'SETTLEMENT_ACCEPTANCE',
          ] } },
          select: { id: true, action: true, details: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async selfResponse(req: any, caseId: string, dto: { code: string; narrative: string; offerEventId?: string }) {
    const { tenantId, userId, employeeId } = await this.selfEmployee(req);
    const narrative = dto.narrative?.trim() || '';
    if (!['EMPLOYEE_RESPONSE', 'APPEAL_SUBMITTED', 'SETTLEMENT_ACCEPTANCE'].includes(dto.code)) {
      throw new BadRequestException('Only employee response, appeal, or settlement acceptance is permitted');
    }
    if (narrative.length < 10 || narrative.length > 4000) {
      throw new BadRequestException('Employee response must be 10-4000 characters');
    }
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({
        where: { tenantId, id: caseId, employeeId, category: { in: ['DISCIPLINE','CLAIMS'] } },
        select: { id: true, category: true, status: true, employeeId: true },
      });
      if (!record) throw new NotFoundException('Disclosed employee case not found');
      const history = await tx.hrGovernanceEvent.findMany({
        where: { tenantId, caseId }, select: { id: true, action: true, actorUserId: true, details: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const latest = (action: string) => history.reduce((index, row, i) => row.action === action ? i : index, -1);
      let acceptedOffer: { id: string; checksum: string } | null = null;
      if (dto.code === 'EMPLOYEE_RESPONSE') {
        const disclosure = record.category === 'DISCIPLINE' ? 'NOTICE_PROPOSED' : 'CLAIM_PROPOSED';
        if (record.status !== 'IN_REVIEW' || latest(disclosure) < 0) {
          throw new ConflictException('Case must be disclosed and under review before reply');
        }
        if (latest('EMPLOYEE_RESPONSE') > latest(disclosure)) {
          throw new ConflictException('Response was already submitted for this disclosure');
        }
        const reviewed = record.category === 'DISCIPLINE' ? 'FINAL_REVIEW' : 'CLAIM_REVIEWED';
        if (latest(reviewed) > latest(disclosure)) {
          throw new ConflictException('The disclosed case was already reviewed');
        }
      } else if (dto.code === 'APPEAL_SUBMITTED') {
        if (record.category !== 'DISCIPLINE' || !['IN_REVIEW','RESOLVED'].includes(record.status) ||
          latest('FINAL_REVIEW') < 0) {
          throw new ConflictException('Appeal requires a disclosed disciplinary review');
        }
        if (latest('APPEAL_SUBMITTED') > latest('APPEAL_REVIEWED')) {
          throw new ConflictException('An employee appeal is already under review');
        }
      } else {
        if (record.category !== 'CLAIMS' || !['IN_REVIEW', 'RESOLVED'].includes(record.status) ||
          latest('SETTLEMENT_OFFER') < 0 || latest('CLAIM_REVIEWED') < 0 ||
          latest('SETTLEMENT_OFFER') < latest('CLAIM_REVIEWED')) {
          throw new ConflictException('A reviewed claim and a settlement offer are required');
        }
        if (latest('SETTLEMENT_ACCEPTANCE') > latest('SETTLEMENT_OFFER')) {
          throw new ConflictException('Settlement offer already accepted');
        }
        const offer = history[latest('SETTLEMENT_OFFER')];
        if (!dto.offerEventId || dto.offerEventId !== offer.id) {
          throw new ConflictException('Acceptance must identify the current settlement offer');
        }
        acceptedOffer = { id: offer.id, checksum: createHash('sha256').update(offer.details, 'utf8').digest('hex') };
      }
      const changed = await tx.hrGovernanceCase.updateMany({
        where: { tenantId, id: caseId, employeeId, status: record.status },
        data: { updatedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Case changed during employee response');
      await tx.hrGovernanceEvent.create({
        data: { tenantId, caseId, actorUserId: userId, action: dto.code,
          details: JSON.stringify({
            narrative, submittedVia: 'EMPLOYEE_SELF_SERVICE',
            acceptedOfferEventId: acceptedOffer?.id ?? null,
            acceptedOfferSha256: acceptedOffer?.checksum ?? null,
          }) },
      });
      return { submitted: true, caseId, code: dto.code };
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

  async assignInvestigator(req: any, id: string, investigatorUserId: string, rationale: string) {
    const tenantId = req.user?.tenantId;
    const actor = req.user?.userId || req.user?.sub || req.user?.id;
    if (!tenantId || !actor) throw new BadRequestException('Authenticated tenant user required');
    if (!investigatorUserId || !rationale?.trim() || rationale.trim().length < 10) {
      throw new BadRequestException('Investigator and assignment rationale are required');
    }
    return prisma.$transaction(async tx => {
      const record = await tx.hrGovernanceCase.findFirst({
        where: { ...tenantWhere(tenantId), id, category: 'INVESTIGATIONS' },
        select: { id: true, status: true, assignedToId: true, employeeId: true, createdById: true },
      });
      if (!record) throw new NotFoundException('Investigation case not found');
      if (record.status === 'CLOSED') throw new ConflictException('Closed cases are read only');
      const investigator = await tx.user.findFirst({
        where: { tenantId, id: investigatorUserId, status: 'ACTIVE', role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      if (!investigator) throw new BadRequestException('Active investigation reviewer not found in tenant');
      const employee = await tx.employee.findFirst({
        where: { tenantId, id: record.employeeId }, select: { userId: true },
      });
      if (record.createdById === investigator.id || employee?.userId === investigator.id) {
        throw new ConflictException('Investigator must be independent of the reporter and subject');
      }
      const changed = await tx.hrGovernanceCase.updateMany({
        where: { tenantId, id, status: record.status, assignedToId: record.assignedToId },
        data: { assignedToId: investigator.id },
      });
      if (changed.count !== 1) throw new ConflictException('Investigation assignment changed concurrently');
      await tx.hrGovernanceEvent.create({
        data: { tenantId, caseId: id, actorUserId: actor, action: 'INVESTIGATOR_ASSIGNED',
          details: JSON.stringify({ investigatorUserId: investigator.id, rationale: rationale.trim() }) },
      });
      return tx.hrGovernanceCase.findFirstOrThrow({
        where: { tenantId, id }, include: { events: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: 'Serializable' });
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
        select: { id: true, category: true, status: true, employeeId: true, assignedToId: true },
      });
      if (!record) throw new NotFoundException('Governance case not found');
      if (record.status === 'CLOSED') throw new ConflictException('Closed cases are read only');
      const history = await tx.hrGovernanceEvent.findMany({
        where: { tenantId, caseId: id }, orderBy: { createdAt: 'asc' },
        select: { action: true, actorUserId: true },
      });
      assertGovernanceAction(record.category, dto.code, actor, history);
      if (record.category === 'INVESTIGATIONS' && ['INTERVIEW','FACT_FINDING'].includes(dto.code) &&
          record.assignedToId !== actor) {
        throw new ConflictException('Only the assigned investigator can record investigation findings');
      }
      if (['FINAL_REVIEW', 'CLAIM_REVIEWED', 'APPEAL_REVIEWED'].includes(dto.code)) {
        const employee = await tx.employee.findFirst({
          where: { tenantId, id: record.employeeId }, select: { userId: true },
        });
        const responseType = dto.code === 'APPEAL_REVIEWED' ? 'APPEAL_SUBMITTED' : 'EMPLOYEE_RESPONSE';
        if (!employee?.userId || !history.some(event =>
          event.action === responseType && event.actorUserId === employee.userId)) {
          throw new ConflictException('Verified employee self-service statement required before review');
        }
      }
      if (record.category === 'EVIDENCE' && dto.code === 'EVIDENCE_REVIEW') {
        const evidenceCount = await tx.hrGovernanceEvidence.count({ where: { tenantId, caseId: id } });
        if (!evidenceCount) throw new ConflictException('Evidence review requires an uploaded original file');
      }
      if (record.category === 'OFFBOARDING' && dto.code === 'ASSET_RETURN_CHECK') {
        const count = await tx.assetCustodyAssignment.count({
          where: { tenantId, employeeId: record.employeeId, status: 'ACTIVE' },
        });
        if (count > 0) throw new ConflictException('Employee still has active custody assignments');
      }
      if (record.category === 'OFFBOARDING' && dto.code === 'ACCESS_REVOKED_CONFIRMED') {
        const employee = await tx.employee.findFirst({
          where: { tenantId, id: record.employeeId }, select: { userId: true },
        });
        if (employee?.userId) {
          const [user, activeSessions] = await Promise.all([
            tx.user.findFirst({ where: { tenantId, id: employee.userId }, select: { status: true } }),
            tx.session.count({ where: { userId: employee.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
          ]);
          if (user?.status === 'ACTIVE' || activeSessions > 0) {
            throw new ConflictException('Employee access or sessions are still active');
          }
        }
      }
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
