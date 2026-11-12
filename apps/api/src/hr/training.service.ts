import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class TrainingService {
  async courses(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.status) where.status = query.status;
    const data = await prisma.trainingCourse.findMany({
      where,
      include: { _count: { select: { sessions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async createCourse(req: any, dto: any) {
    const cost = dto.cost === undefined ? null : Number(dto.cost);
    const hours = dto.hours === undefined ? null : Number(dto.hours);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) throw new BadRequestException('Training cost must be non-negative');
    if (hours !== null && (!Number.isFinite(hours) || hours <= 0)) throw new BadRequestException('Training hours must be positive');
    return prisma.trainingCourse.create({
      data: {
        tenantId: req.user?.tenantId,
        title: dto.title,
        code: dto.code || null,
        provider: dto.provider || null,
        hours,
        deliveryMode: dto.deliveryMode || null,
        cost,
        certificateRequired: dto.certificateRequired === true,
        description: dto.description || null,
      },
    });
  }

  async sessions(req: any, query: any) {
    const where: any = { ...tenantWhere(req.user?.tenantId) };
    if (query.courseId) where.courseId = query.courseId;
    if (query.status) where.status = query.status;
    const data = await prisma.trainingSession.findMany({
      where,
      include: {
        course: true,
        enrollments: {
          include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async createSession(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const course = await prisma.trainingCourse.findFirst({ where: { ...tenantWhere(tenantId), id: dto.courseId, status: 'ACTIVE' } });
    if (!course) throw new NotFoundException('Active training course not found');
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) throw new BadRequestException('Training session end must follow start');
    const capacity = dto.capacity === undefined ? null : Number(dto.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) throw new BadRequestException('Training capacity must be a positive integer');
    return prisma.trainingSession.create({
      data: {
        tenantId,
        courseId: course.id,
        startAt,
        endAt,
        capacity,
        location: dto.location || null,
        trainer: dto.trainer || null,
      },
    });
  }

  async enroll(req: any, sessionId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    return prisma.$transaction(async (tx) => {
      const [session, employee] = await Promise.all([
        tx.trainingSession.findFirst({ where: { ...tenantWhere(tenantId), id: sessionId }, include: { course: true } }),
        tx.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.employeeId } }),
      ]);
      if (!session) throw new NotFoundException('Training session not found');
      if (!employee) throw new NotFoundException('Employee not found');
      if (session.status === 'CANCELLED' || session.status === 'COMPLETED') throw new ConflictException('Training session is not open for enrollment');
      if (employee.status !== 'ACTIVE') throw new ConflictException('Only active employees can be enrolled');

      if (session.capacity) {
        const count = await tx.trainingEnrollment.count({
          where: { sessionId, status: { in: ['NOMINATED','ENROLLED','COMPLETED'] } },
        });
        if (count >= session.capacity) throw new ConflictException('Training session capacity is full');
      }

      return tx.trainingEnrollment.create({
        data: {
          tenantId,
          sessionId,
          employeeId: employee.id,
          status: dto.status || 'NOMINATED',
          notes: dto.notes || null,
        },
      });
    });
  }

  async updateEnrollment(req: any, sessionId: string, enrollmentId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { ...tenantWhere(tenantId), id: enrollmentId, sessionId },
      include: { session: { include: { course: true } } },
    });
    if (!enrollment) throw new NotFoundException('Training enrollment not found');
    if (!['NOMINATED','ENROLLED','COMPLETED','CANCELLED','NO_SHOW'].includes(dto.status)) {
      throw new BadRequestException('Unsupported training enrollment status');
    }
    if (dto.status === 'COMPLETED' && enrollment.session.course.certificateRequired && !dto.certificateNumber && !dto.certificateUrl) {
      throw new BadRequestException('Certificate evidence is required for this course');
    }
    const score = dto.score === undefined ? undefined : Number(dto.score);
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) {
      throw new BadRequestException('Training score must be 0-100');
    }
    return prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: dto.status,
        score,
        certificateNumber: dto.certificateNumber ?? enrollment.certificateNumber,
        certificateUrl: dto.certificateUrl ?? enrollment.certificateUrl,
        notes: dto.notes ?? enrollment.notes,
        completedAt: dto.status === 'COMPLETED' ? new Date() : enrollment.completedAt,
      },
    });
  }

  async setSessionStatus(req: any, id: string, status: string) {
    const tenantId = req.user?.tenantId;
    const session = await prisma.trainingSession.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!session) throw new NotFoundException('Training session not found');
    if (!['IN_PROGRESS','COMPLETED','CANCELLED'].includes(status)) throw new BadRequestException('Unsupported training session status');
    if (status === 'COMPLETED') {
      const pending = await prisma.trainingEnrollment.count({
        where: { sessionId: id, status: { in: ['NOMINATED','ENROLLED'] } },
      });
      if (pending > 0) throw new ConflictException('Resolve pending enrollments before completing the training session');
    }
    return prisma.trainingSession.update({ where: { id }, data: { status } });
  }

  async selfTraining(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return prisma.trainingEnrollment.findMany({
      where: { ...tenantWhere(tenantId), employeeId: employee.id },
      include: { session: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
