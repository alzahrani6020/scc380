import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';
import { createHash } from 'node:crypto';

export const GOVERNANCE_CATEGORIES = [
  'VIOLATIONS', 'INVESTIGATIONS', 'EVIDENCE', 'DISCIPLINE', 'CONFLICTS',
  'CLAIMS', 'LEGAL', 'OFFBOARDING', 'COMPLIANCE',
] as const;

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
      await tx.hrGovernanceEvent.create({ data: {
        tenantId, caseId: id, actorUserId: actor, action: 'NOTE', details: details.trim(),
      } });
      return tx.hrGovernanceCase.findFirstOrThrow({ where: { ...tenantWhere(tenantId), id }, include: { events: true } });
    });
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
    });
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
