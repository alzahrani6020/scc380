import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

const REQUEST_TYPES = new Set([
  'EMPLOYMENT_CERTIFICATE',
  'SALARY_CERTIFICATE',
  'LETTER',
  'DATA_CORRECTION',
  'BENEFIT_INQUIRY',
  'OTHER',
]);

@Injectable()
export class HrRequestsService {
  async listAdmin(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.employeeId) where.employeeId = query.employeeId;
    const data = await prisma.hrRequest.findMany({
      where,
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data, count: data.length };
  }

  async listSelf(req: any) {
    const employee = await this.resolveEmployee(req);
    return prisma.hrRequest.findMany({
      where: { ...tenantWhere(req.user.tenantId), employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSelf(req: any, dto: any) {
    const employee = await this.resolveEmployee(req);
    if (!REQUEST_TYPES.has(dto.type)) throw new BadRequestException('Unsupported HR request type');
    return prisma.hrRequest.create({
      data: {
        tenantId: req.user.tenantId,
        employeeId: employee.id,
        type: dto.type,
        subject: dto.subject,
        details: dto.details || {},
        status: 'PENDING',
      },
    });
  }

  async cancelSelf(req: any, id: string) {
    const employee = await this.resolveEmployee(req);
    const item = await prisma.hrRequest.findFirst({
      where: { ...tenantWhere(req.user.tenantId), id, employeeId: employee.id },
    });
    if (!item) throw new NotFoundException('HR request not found');
    if (item.status !== 'PENDING') throw new ConflictException('Only pending requests can be cancelled');
    return prisma.hrRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async review(req: any, id: string, decision: 'APPROVED' | 'REJECTED', resolution?: string) {
    const tenantId = req.user?.tenantId;
    const item = await prisma.hrRequest.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!item) throw new NotFoundException('HR request not found');
    if (item.status !== 'PENDING') throw new ConflictException('Only pending requests can be reviewed');
    if (decision === 'REJECTED' && !resolution?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    return prisma.hrRequest.update({
      where: { id },
      data: {
        status: decision,
        resolution: resolution?.trim() || null,
        reviewedById: req.user?.userId || req.user?.id || null,
        reviewedAt: new Date(),
      },
    });
  }

  private async resolveEmployee(req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id;
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), userId } });
    if (!employee) throw new NotFoundException('User is not linked to an employee profile');
    return employee;
  }
}
