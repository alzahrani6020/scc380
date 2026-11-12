import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { prisma, tenantWhere } from '@scc/database';
import { defaultLifecycleTasks } from './hr-lifecycle-defaults';

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const RESUME_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class RecruitmentService {
  async jobs(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.status) where.status = query.status;
    const data = await prisma.recruitmentJobOpening.findMany({
      where,
      include: { department: true, _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async createJob(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (dto.departmentId) {
      const dept = await prisma.department.findFirst({ where: { ...tenantWhere(tenantId), id: dto.departmentId } });
      if (!dept) throw new NotFoundException('Department not found');
    }
    return prisma.recruitmentJobOpening.create({
      data: {
        tenantId,
        departmentId: dto.departmentId || null,
        title: dto.title,
        code: dto.code || null,
        headcount: dto.headcount || 1,
        employmentType: dto.employmentType || null,
        location: dto.location || null,
        description: dto.description || null,
        requirements: dto.requirements || null,
        ownerUserId: req.user?.userId || req.user?.id || null,
      },
    });
  }

  async setJobStatus(req: any, id: string, status: string) {
    const tenantId = req.user?.tenantId;
    const job = await prisma.recruitmentJobOpening.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!job) throw new NotFoundException('Job opening not found');
    if (!['OPEN','CLOSED','CANCELLED'].includes(status)) throw new BadRequestException('Unsupported job status');
    return prisma.recruitmentJobOpening.update({
      where: { id },
      data: {
        status,
        openedAt: status === 'OPEN' ? (job.openedAt || new Date()) : job.openedAt,
        closedAt: ['CLOSED','CANCELLED'].includes(status) ? new Date() : null,
      },
    });
  }

  async candidates(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.jobOpeningId) where.jobOpeningId = query.jobOpeningId;
    if (query.status) where.status = query.status;
    const data = await prisma.recruitmentCandidate.findMany({
      where,
      select: {
        id: true, tenantId: true, jobOpeningId: true, hiredEmployeeId: true,
        firstName: true, lastName: true, email: true, phone: true, source: true,
        status: true, rating: true, notes: true, offerSalary: true, offerDate: true,
        resumeFileName: true, resumeMimeType: true, resumeSizeBytes: true, resumeChecksumSha256: true,
        hiredAt: true, createdAt: true, updatedAt: true,
        jobOpening: { select: { id: true, title: true, code: true, status: true } },
        interviews: { orderBy: { scheduledAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async addCandidate(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const job = await prisma.recruitmentJobOpening.findFirst({ where: { ...tenantWhere(tenantId), id: dto.jobOpeningId } });
    if (!job) throw new NotFoundException('Job opening not found');
    if (job.status !== 'OPEN') throw new ConflictException('Candidates can only be added to open jobs');

    let resume: any = {};
    if (dto.resumeContentBase64) {
      if (!dto.resumeMimeType || !RESUME_MIME.has(dto.resumeMimeType)) throw new BadRequestException('Unsupported resume MIME type');
      const content = Buffer.from(dto.resumeContentBase64, 'base64');
      if (!content.length || content.length > MAX_RESUME_BYTES) throw new BadRequestException('Resume must be between 1 byte and 5 MB');
      resume = {
        resumeFileName: dto.resumeFileName || 'resume',
        resumeMimeType: dto.resumeMimeType,
        resumeSizeBytes: content.length,
        resumeChecksumSha256: createHash('sha256').update(content).digest('hex'),
        resumeContent: content,
      };
    }

    return prisma.recruitmentCandidate.create({
      data: {
        tenantId,
        jobOpeningId: job.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email || null,
        phone: dto.phone || null,
        source: dto.source || null,
        notes: dto.notes || null,
        ...resume,
      },
      select: { id: true, jobOpeningId: true, firstName: true, lastName: true, email: true, phone: true, source: true, status: true, createdAt: true },
    });
  }

  async getResume(req: any, id: string) {
    const candidate = await prisma.recruitmentCandidate.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.resumeContent || !candidate.resumeMimeType || !candidate.resumeFileName) throw new NotFoundException('Candidate resume not found');
    return candidate;
  }

  async setCandidateStatus(req: any, id: string, status: string, notes?: string) {
    const tenantId = req.user?.tenantId;
    const candidate = await prisma.recruitmentCandidate.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!['SCREENING','INTERVIEW','REJECTED','WITHDRAWN'].includes(status)) throw new BadRequestException('Unsupported candidate status transition');
    if (candidate.status === 'HIRED') throw new ConflictException('Hired candidate cannot change status');
    return prisma.recruitmentCandidate.update({ where: { id }, data: { status, notes: notes ?? candidate.notes } });
  }

  async scheduleInterview(req: any, candidateId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const candidate = await prisma.recruitmentCandidate.findFirst({ where: { ...tenantWhere(tenantId), id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (['HIRED','REJECTED','WITHDRAWN'].includes(candidate.status)) throw new ConflictException('Candidate is not interviewable');
    return prisma.$transaction(async (tx) => {
      const interview = await tx.recruitmentInterview.create({
        data: {
          tenantId, candidateId,
          scheduledAt: new Date(dto.scheduledAt),
          interviewerUserId: dto.interviewerUserId || null,
          type: dto.type || null,
        },
      });
      await tx.recruitmentCandidate.update({ where: { id: candidateId }, data: { status: 'INTERVIEW' } });
      return interview;
    });
  }

  async completeInterview(req: any, candidateId: string, interviewId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const interview = await prisma.recruitmentInterview.findFirst({
      where: { ...tenantWhere(tenantId), id: interviewId, candidateId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    const score = Number(dto.score);
    if (!Number.isFinite(score) || score < 0 || score > 5) throw new BadRequestException('Interview score must be 0-5');
    return prisma.recruitmentInterview.update({
      where: { id: interviewId },
      data: { status: 'COMPLETED', score, feedback: dto.feedback || null, completedAt: new Date() },
    });
  }

  async makeOffer(req: any, id: string, dto: any) {
    const candidate = await prisma.recruitmentCandidate.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (['HIRED','REJECTED','WITHDRAWN'].includes(candidate.status)) throw new ConflictException('Candidate cannot receive an offer');
    const salary = Number(dto.offerSalary);
    if (!Number.isFinite(salary) || salary <= 0) throw new BadRequestException('Offer salary must be positive');
    return prisma.recruitmentCandidate.update({
      where: { id },
      data: { status: 'OFFER', offerSalary: salary, offerDate: new Date(), notes: dto.notes ?? candidate.notes },
    });
  }

  async hire(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    return prisma.$transaction(async (tx) => {
      const candidate = await tx.recruitmentCandidate.findFirst({
        where: { ...tenantWhere(tenantId), id },
        include: { jobOpening: true },
      });
      if (!candidate) throw new NotFoundException('Candidate not found');
      if (candidate.status !== 'OFFER') throw new ConflictException('Candidate must be in OFFER status before hiring');
      if (candidate.hiredEmployeeId) throw new ConflictException('Candidate is already hired');

      const duplicate = candidate.email
        ? await tx.employee.findFirst({ where: { ...tenantWhere(tenantId), email: candidate.email } })
        : null;
      if (duplicate) throw new ConflictException('Candidate email is already used by an employee');

      const employee = await tx.employee.create({
        data: {
          tenantId,
          employeeCode: dto.employeeCode,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email || null,
          phone: candidate.phone || null,
          departmentId: candidate.jobOpening.departmentId,
          jobTitle: dto.jobTitle || candidate.jobOpening.title,
          employmentType: dto.employmentType || candidate.jobOpening.employmentType || 'FULL_TIME',
          hireDate: new Date(dto.hireDate),
          basicSalary: dto.basicSalary !== undefined ? Number(dto.basicSalary) : Number(candidate.offerSalary || 0),
          housingAllowance: Number(dto.housingAllowance || 0),
          transportAllowance: Number(dto.transportAllowance || 0),
          otherAllowances: Number(dto.otherAllowances || 0),
        },
      });
      const tasks = defaultLifecycleTasks('ONBOARDING');
      await tx.hrLifecycleCase.create({
        data: {
          tenantId, employeeId: employee.id, type: 'ONBOARDING', status: 'OPEN', startDate: employee.hireDate,
          createdById: req.user?.userId || req.user?.id || null,
          tasks: { create: tasks.map((task) => ({ ...task, tenantId })) },
        },
      });
      await tx.recruitmentCandidate.update({
        where: { id },
        data: { status: 'HIRED', hiredEmployeeId: employee.id, hiredAt: new Date() },
      });

      const hiredCount = await tx.recruitmentCandidate.count({
        where: { jobOpeningId: candidate.jobOpeningId, status: 'HIRED' },
      });
      if (hiredCount >= candidate.jobOpening.headcount) {
        await tx.recruitmentJobOpening.update({
          where: { id: candidate.jobOpeningId },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }
      return employee;
    });
  }
}
