import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

const money = (v: any) => Number(v || 0);

@Injectable()
export class PerformanceService {
  async cycles(req: any) {
    const data = await prisma.performanceCycle.findMany({
      where: tenantWhere(req.user?.tenantId),
      include: { _count: { select: { reviews: true } } },
      orderBy: { startDate: 'desc' },
    });
    return { data, count: data.length };
  }

  async createCycle(req: any, dto: any) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new BadRequestException('Performance cycle end date must follow start date');
    return prisma.performanceCycle.create({
      data: { tenantId: req.user?.tenantId, name: dto.name, startDate, endDate, status: 'DRAFT' },
    });
  }

  async setCycleStatus(req: any, id: string, status: string) {
    const tenantId = req.user?.tenantId;
    const cycle = await prisma.performanceCycle.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    if (!['ACTIVE','CLOSED'].includes(status)) throw new BadRequestException('Unsupported performance cycle status');
    if (status === 'CLOSED') {
      const drafts = await prisma.performanceReview.count({ where: { tenantId, cycleId: id, status: 'DRAFT' } });
      if (drafts > 0) throw new ConflictException('Cycle cannot close while draft reviews remain');
    }
    return prisma.performanceCycle.update({ where: { id }, data: { status } });
  }

  async reviews(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    const data = await prisma.performanceReview.findMany({
      where,
      include: {
        cycle: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, jobTitle: true } },
        goals: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async createReview(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    const [cycle, employee] = await Promise.all([
      prisma.performanceCycle.findFirst({ where: { ...tenantWhere(tenantId), id: dto.cycleId } }),
      prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: dto.employeeId } }),
    ]);
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    if (!employee) throw new NotFoundException('Employee not found');
    if (cycle.status === 'CLOSED') throw new ConflictException('Performance cycle is closed');
    return prisma.performanceReview.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        employeeId: employee.id,
        reviewerUserId: dto.reviewerUserId || req.user?.userId || req.user?.id || null,
      },
      include: { goals: true },
    });
  }

  async addGoal(req: any, reviewId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const review = await prisma.performanceReview.findFirst({ where: { ...tenantWhere(tenantId), id: reviewId } });
    if (!review) throw new NotFoundException('Performance review not found');
    if (review.status !== 'DRAFT') throw new ConflictException('Goals can only be edited before review submission');
    const weight = Number(dto.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new BadRequestException('Goal weight must be 0-100');
    const existing = await prisma.performanceGoal.aggregate({ where: { reviewId }, _sum: { weight: true } });
    if (money(existing._sum.weight) + weight > 100.0001) throw new BadRequestException('Performance goal weights cannot exceed 100%');
    return prisma.performanceGoal.create({
      data: {
        tenantId,
        reviewId,
        employeeId: review.employeeId,
        title: dto.title,
        description: dto.description || null,
        weight,
        target: dto.target || null,
      },
    });
  }

  async updateGoal(req: any, reviewId: string, goalId: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const [review, goal] = await Promise.all([
      prisma.performanceReview.findFirst({ where: { ...tenantWhere(tenantId), id: reviewId } }),
      prisma.performanceGoal.findFirst({ where: { ...tenantWhere(tenantId), id: goalId, reviewId } }),
    ]);
    if (!review) throw new NotFoundException('Performance review not found');
    if (!goal) throw new NotFoundException('Performance goal not found');
    if (review.status !== 'DRAFT') throw new ConflictException('Submitted review goals are locked');

    const data: any = {};
    for (const field of ['title','description','target','result','status']) {
      if (Object.prototype.hasOwnProperty.call(dto, field)) data[field] = dto[field] || null;
    }
    if (dto.rating !== undefined) {
      const rating = Number(dto.rating);
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new BadRequestException('Goal rating must be 0-5');
      data.rating = rating;
    }
    if (dto.weight !== undefined) {
      const weight = Number(dto.weight);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new BadRequestException('Goal weight must be 0-100');
      const existing = await prisma.performanceGoal.aggregate({
        where: { reviewId, id: { not: goalId } },
        _sum: { weight: true },
      });
      if (money(existing._sum.weight) + weight > 100.0001) throw new BadRequestException('Performance goal weights cannot exceed 100%');
      data.weight = weight;
    }
    return prisma.performanceGoal.update({ where: { id: goalId }, data });
  }

  async submit(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const review = await prisma.performanceReview.findFirst({
      where: { ...tenantWhere(tenantId), id },
      include: { goals: true, cycle: true },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    if (review.status !== 'DRAFT') throw new ConflictException('Only draft reviews can be submitted');
    if (review.cycle.status === 'CLOSED') throw new ConflictException('Performance cycle is closed');
    if (!review.goals.length) throw new BadRequestException('Performance review requires at least one goal');
    const totalWeight = review.goals.reduce((sum, goal) => sum + money(goal.weight), 0);
    if (Math.abs(totalWeight - 100) > 0.01) throw new BadRequestException('Performance goal weights must total 100%');
    if (review.goals.some((goal) => goal.rating === null)) throw new BadRequestException('Every goal requires a rating before submission');
    const overallRating = review.goals.reduce((sum, goal) => sum + (money(goal.weight) * money(goal.rating) / 100), 0);
    return prisma.performanceReview.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        overallRating: Math.round(overallRating * 100) / 100,
        managerSummary: dto.managerSummary || review.managerSummary,
        submittedAt: new Date(),
      },
      include: { goals: true, employee: true, cycle: true },
    });
  }

  async selfReviews(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return prisma.performanceReview.findMany({
      where: { ...tenantWhere(tenantId), employeeId: employee.id },
      include: { cycle: true, goals: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledge(req: any, id: string, employeeComment?: string) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    const review = await prisma.performanceReview.findFirst({ where: { ...tenantWhere(tenantId), id, employeeId: employee.id } });
    if (!review) throw new NotFoundException('Performance review not found');
    if (review.status !== 'SUBMITTED') throw new ConflictException('Only submitted reviews can be acknowledged');
    return prisma.performanceReview.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', employeeComment: employeeComment || null, acknowledgedAt: new Date() },
    });
  }
}
