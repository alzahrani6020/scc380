import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { prisma, tenantWhere } from '@scc/database';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

@Injectable()
export class EmployeeDocumentsService {
  async findAll(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    const where: any = { ...tenantWhere(tenantId) };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;

    const data = await prisma.employeeDocument.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        type: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        issuedAt: true,
        expiresAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
    });
    return { data, count: data.length };
  }

  async create(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    await this.assertEmployee(tenantId, dto.employeeId);
    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException('Unsupported document MIME type');
    }

    const content = Buffer.from(dto.contentBase64 || '', 'base64');
    if (!content.length) throw new BadRequestException('Document content is required');
    if (content.length > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException('Document exceeds 5 MB limit');
    }

    const checksumSha256 = createHash('sha256').update(content).digest('hex');
    return prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        type: dto.type,
        title: dto.title,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: content.length,
        checksumSha256,
        content,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        notes: dto.notes || null,
      },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        type: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        issuedAt: true,
        expiresAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(req: any, id: string, dto: any) {
    const tenantId = req.user?.tenantId;
    const existing = await prisma.employeeDocument.findFirst({ where: { ...tenantWhere(tenantId), id } });
    if (!existing) throw new NotFoundException('Employee document not found');

    const data: any = { ...dto };
    if (Object.prototype.hasOwnProperty.call(data, 'issuedAt')) data.issuedAt = data.issuedAt ? new Date(data.issuedAt) : null;
    if (Object.prototype.hasOwnProperty.call(data, 'expiresAt')) data.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    return prisma.employeeDocument.update({
      where: { id },
      data,
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        type: true,
        title: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        issuedAt: true,
        expiresAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getFile(req: any, id: string) {
    const item = await prisma.employeeDocument.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!item) throw new NotFoundException('Employee document not found');
    return item;
  }

  async remove(req: any, id: string) {
    const existing = await prisma.employeeDocument.findFirst({ where: { ...tenantWhere(req.user?.tenantId), id } });
    if (!existing) throw new NotFoundException('Employee document not found');
    await prisma.employeeDocument.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertEmployee(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({ where: { ...tenantWhere(tenantId), id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
  }
}
