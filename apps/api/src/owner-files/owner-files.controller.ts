import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '@scc/database';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const MIME = ['text/plain', 'text/csv', 'application/pdf'] as const;
const MAX_BYTES = 1024 * 1024;
class UploadDto {
  @IsString() @MaxLength(160) title!: string;
  @IsString() @MaxLength(160) fileName!: string;
  @IsIn(MIME) mimeType!: string;
  @IsString() contentBase64!: string;
}
class RequestDto {
  @IsString() fileId!: string;
  @IsIn(['FULL', 'PARTIAL']) scope!: 'FULL' | 'PARTIAL';
  @IsOptional() @IsInt() @Min(1) startLine?: number;
  @IsOptional() @IsInt() @Min(1) endLine?: number;
}
class DecisionDto {
  @IsString() requestId!: string;
  @IsIn(['APPROVE', 'REJECT', 'REVOKE']) decision!: 'APPROVE' | 'REJECT' | 'REVOKE';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

// Commercial file center: separate from HR/ERP and the existing activity report permissions.
// Access decisions derive from verified JWT/DB identities, not arbitrary request fields.
@ApiTags('Owner file center')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('owner-files')
export class OwnerFilesController {
  private tenant(req: any): string {
    const id = req.user?.tenantId;
    if (!id || !req.user?.userId || !req.user?.sessionId) throw new ForbiddenException('Active tenant session required');
    return id;
  }
  private async owner(req: any) {
    const configured = process.env.SCC380_ACTIVITY_OWNER_EMAIL?.trim().toLowerCase();
    if (!configured || !['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)
      || !req.user?.sessionId || req.user?.email?.toLowerCase() !== configured) {
      throw new ForbiddenException('Owner authorization required');
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.userId },
      select: { email: true, role: true, status: true } });
    if (!user || user.status !== 'ACTIVE' || user.role !== req.user.role ||
      user.email.toLowerCase() !== configured) throw new ForbiddenException('Owner authorization required');
  }
  private async fileForTenant(req: any, fileId: string) {
    const file = await prisma.ownerFile.findFirst({ where: { id: fileId, tenantId: this.tenant(req) } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
  private async validateScope(file: { mimeType: string; content: Uint8Array }, scope: string,
    startLine?: number, endLine?: number) {
    if (scope === 'FULL') {
      if (startLine !== undefined || endLine !== undefined) throw new BadRequestException('FULL cannot select lines');
      return;
    }
    if (scope !== 'PARTIAL' || !MIME.includes(file.mimeType as any) ||
      !Number.isInteger(startLine) || !Number.isInteger(endLine) ||
      (startLine as number) < 1 || (endLine as number) < (startLine as number) ||
      (endLine as number) - (startLine as number) > 499) {
      throw new BadRequestException('Partial delivery supports text line ranges of up to 500 lines only');
    }
    if (file.mimeType === 'application/pdf') {
      let pdf: PDFDocument;
      try { pdf = await PDFDocument.load(Buffer.from(file.content)); }
      catch { throw new BadRequestException('Invalid or encrypted PDF document'); }
      if ((endLine as number) > pdf.getPageCount()) throw new BadRequestException('Page range exceeds PDF');
      return;
    }
    const count = Buffer.from(file.content).toString('utf8').split(/\r?\n/).length;
    if ((endLine as number) > count) throw new BadRequestException('Line range exceeds document');
  }
  @Get()
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    return prisma.ownerFile.findMany({ where: { tenantId },
      select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true, checksumSha256: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Post()
  async upload(@Req() req: any, @Body() body: UploadDto) {
    const tenantId = this.tenant(req);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) throw new ForbiddenException('Tenant admin required');
    const bytes = typeof body.contentBase64 === 'string' ? body.contentBase64 : '';
    if (!bytes || bytes.length > Math.ceil(MAX_BYTES * 4 / 3) + 8 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bytes)) {
      throw new BadRequestException('Invalid base64 file');
    }
    const content = Buffer.from(bytes, 'base64');
    if (!content.length || content.length > MAX_BYTES) throw new BadRequestException('File exceeds 1 MB limit');
    if (!MIME.includes(body.mimeType as any) || !body.title?.trim() || !body.fileName?.trim()) {
      throw new BadRequestException('Invalid file metadata');
    }
    if (['text/plain', 'text/csv'].includes(body.mimeType)) {
      try { new TextDecoder('utf-8', { fatal: true }).decode(content); }
      catch { throw new BadRequestException('Invalid UTF-8 text'); }
    }
    if (body.mimeType === 'application/pdf') {
      // Validate the uploaded bytes before persisting; malformed and encrypted
      // PDFs cannot safely support the approved partial-page workflow.
      if (!content.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        throw new BadRequestException('Invalid PDF file');
      }
      try {
        const document = await PDFDocument.load(content);
        if (document.getPageCount() < 1) throw new Error('PDF contains no pages');
      } catch {
        throw new BadRequestException('Invalid or encrypted PDF document');
      }
    }
    return prisma.ownerFile.create({
      data: { tenantId, title: body.title.trim(), fileName: body.fileName.trim(),
        mimeType: body.mimeType, content, sizeBytes: content.length,
        checksumSha256: createHash('sha256').update(content).digest('hex'), createdById: req.user.userId },
      select: { id: true, title: true, fileName: true, sizeBytes: true, checksumSha256: true },
    });
  }
  @Post('requests')
  async request(@Req() req: any, @Body() body: RequestDto) {
    const file = await this.fileForTenant(req, body.fileId);
    await this.validateScope(file, body.scope, body.startLine, body.endLine);
    const tenantId = this.tenant(req);
    return prisma.ownerFileRequest.create({
      data: { fileId: file.id, tenantId, requesterId: req.user.userId,
        scope: body.scope, startLine: body.startLine, endLine: body.endLine },
      select: { id: true, status: true, scope: true, createdAt: true },
    });
  }
  @Get('requests/mine')
  async mine(@Req() req: any) {
    return prisma.ownerFileRequest.findMany({
      where: { tenantId: this.tenant(req), requesterId: req.user.userId },
      select: { id: true, fileId: true, scope: true, startLine: true, endLine: true,
        status: true, createdAt: true, decidedAt: true,
        file: { select: { fileName: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }
  @Get('owner/requests')
  async queue(@Req() req: any) {
    await this.owner(req);
    return prisma.ownerFileRequest.findMany({
      select: { id: true, fileId: true, tenantId: true, requesterId: true, scope: true,
        startLine: true, endLine: true, status: true, createdAt: true, decidedAt: true,
        file: { select: { title: true, fileName: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }
  @Get('owner/audit')
  async ownerAudit(@Req() req: any) {
    await this.owner(req);
    // Only commercial file center events; exclude invoice/payment payloads and secrets.
    return prisma.auditLog.findMany({
      where: { entityType: 'OWNER_FILE_REQUEST',
        action: { startsWith: 'OWNER_FILE_' } },
      select: { id: true, tenantId: true, userId: true, entityId: true,
        action: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }
  @Post('owner/decide')
  async decide(@Req() req: any, @Body() body: DecisionDto) {
    await this.owner(req);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${body.requestId}))`;
      const current = await tx.ownerFileRequest.findUnique({ where: { id: body.requestId } });
      if (!current) throw new NotFoundException('Request not found');
      if (current.requesterId === req.user.userId) throw new ForbiddenException('Self approval prohibited');
      const allowed = body.decision === 'REVOKE' ? current.status === 'APPROVED' : current.status === 'PENDING';
      if (!allowed) throw new BadRequestException('Invalid or duplicate decision');
      const status = body.decision === 'APPROVE' ? 'APPROVED' : body.decision === 'REVOKE' ? 'REVOKED' : 'REJECTED';
      const item = await tx.ownerFileRequest.update({
        where: { id: current.id }, data: { status, decidedAt: new Date(),
          decidedById: req.user.userId, reason: body.reason || null },
      });
      await tx.auditLog.create({
        data: { tenantId: current.tenantId, userId: req.user.userId, entityType: 'OWNER_FILE_REQUEST',
          entityId: current.id, action: 'OWNER_FILE_' + status,
          newValues: { fileId: current.fileId, scope: current.scope, requesterId: current.requesterId } },
      });
      return { id: item.id, status: item.status };
    });
  }
  private async paid(req: any, fileId: string, scope: 'FULL' | 'PARTIAL', invoiceNumber?: string) {
    // No production PSP webhook integration exists yet. A bookkeeping payment or manually
    // inserted audit log is not trusted settlement evidence. Keep production fail-closed.
    // Synthetic attestation exercises the entitlement rules ONLY in isolated CI tests.
    if (process.env.NODE_ENV !== 'test' || process.env.SCC380_TEST_DATABASE_ISOLATED !== 'YES') return false;
    if (!invoiceNumber || invoiceNumber.length > 80 || !req.user?.email) return false;
    const tenantId = this.tenant(req);
    const account = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { emailVerified: true } });
    if (!account?.emailVerified) return false;
    const contacts = await prisma.contact.findMany({
      where: { tenantId, email: { equals: req.user.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!contacts.length) return false;
    const invoice = await prisma.invoice.findFirst({
      where: { tenantId, invoiceNumber, status: 'PAID', contactId: { in: contacts.map(x => x.id) },
        items: { some: { tenantId, product: { tenantId, sku: 'SCC380-FILE-' + fileId + '-' + scope } } } },
      select: { total: true, payments: { select: { tenantId: true, amount: true, status: true } } },
    });
    if (!invoice || Number(invoice.total) <= 0) return false;
    // ERP operators can create bookkeeping payments. That alone is NOT gateway proof.
    // A separate, server-origin verified settlement attestation must bind this exact
    // invoice, customer, file, scope and tenant. No browser route creates attestations.
    const evidence = await prisma.auditLog.findFirst({
      where: { tenantId, entityType: 'OWNER_FILE_PAYMENT', entityId: invoiceNumber,
        action: 'FILE_PROVIDER_SETTLEMENT_VERIFIED',
        newValues: { path: ['fileId'], equals: fileId } },
      orderBy: { createdAt: 'desc' }, select: { newValues: true },
    });
    const proof = evidence?.newValues as { userId?: string; scope?: string; receiptId?: string;
      settlement?: string; source?: string } | null;
    if (!proof || proof.userId !== req.user.userId || proof.scope !== scope ||
        proof.settlement !== 'SETTLED' || proof.source !== 'TRUSTED_GATEWAY' ||
        !proof.receiptId) return false;
    const settled = invoice.payments.filter(x => x.tenantId === tenantId && x.status === 'COMPLETED')
      .reduce((sum, x) => sum + Number(x.amount), 0);
    return settled + 0.009 >= Number(invoice.total);
  }
  @Get('requests/:id/download')
  async download(@Req() req: any, @Param('id') id: string,
    @Query('invoiceNumber') invoiceNumber: string | undefined, @Res() res: Response) {
    const tenantId = this.tenant(req);
    const request = await prisma.ownerFileRequest.findFirst({
      where: { id, tenantId, requesterId: req.user.userId }, include: { file: true },
    });
    if (!request) throw new NotFoundException('Download request not found');
    if (request.status === 'REJECTED' || request.status === 'REVOKED') {
      throw new ForbiddenException('Download request is rejected or revoked');
    }
    const authorized = request.status === 'APPROVED' || await this.paid(req, request.fileId, request.scope as 'FULL' | 'PARTIAL', invoiceNumber);
    await prisma.auditLog.create({
      data: { tenantId, userId: req.user.userId, entityType: 'OWNER_FILE_REQUEST', entityId: request.id,
        action: authorized ? 'OWNER_FILE_DELIVERY_STARTED' : 'OWNER_FILE_DELIVERY_DENIED',
        newValues: { fileId: request.fileId, scope: request.scope } },
    });
    if (!authorized) throw new ForbiddenException('Verified payment or owner approval required');
    await this.validateScope(request.file, request.scope, request.startLine ?? undefined, request.endLine ?? undefined);
    const content = Buffer.from(request.file.content);
    let output: Buffer;
    if (request.scope === 'FULL') output = content;
    else if (request.file.mimeType === 'application/pdf') {
      const source = await PDFDocument.load(content);
      const target = await PDFDocument.create();
      const indexes = Array.from({ length: request.endLine! - request.startLine! + 1 },
        (_, index) => request.startLine! - 1 + index);
      const pages = await target.copyPages(source, indexes);
      for (const page of pages) target.addPage(page);
      output = Buffer.from(await target.save());
    } else output = Buffer.from(content.toString('utf8').split(/\r?\n/)
      .slice(request.startLine! - 1, request.endLine!).join('\n'), 'utf8');
    const checksum = createHash('sha256').update(output).digest('hex');
    res.setHeader('Content-Type', request.file.mimeType);
    res.setHeader('Content-Length', output.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(request.file.fileName)}`);
    res.setHeader('X-Content-SHA256', checksum);
    res.once('finish', () => { void prisma.auditLog.create({
      data: { tenantId, userId: req.user.userId, entityType: 'OWNER_FILE_REQUEST', entityId: request.id,
        action: 'OWNER_FILE_HTTP_RESPONSE_FINISHED',
        newValues: { scope: request.scope, bytes: output.length, sha256: checksum, proof: 'HTTP_ONLY' } },
    }).catch(() => undefined); });
    res.once('close', () => { if (!res.writableFinished) { void prisma.auditLog.create({
      data: { tenantId, userId: req.user.userId, entityType: 'OWNER_FILE_REQUEST', entityId: request.id,
        action: 'OWNER_FILE_HTTP_RESPONSE_INTERRUPTED', newValues: { proof: 'HTTP_ONLY' } },
    }).catch(() => undefined); } });
    res.end(output);
  }
}
