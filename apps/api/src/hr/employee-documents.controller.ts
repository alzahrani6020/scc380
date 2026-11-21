import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { EmployeeDocumentsService } from './employee-documents.service';

const DOCUMENT_TYPES = ['NATIONAL_ID', 'IQAMA', 'PASSPORT', 'CERTIFICATE', 'LICENSE', 'CONTRACT_ATTACHMENT', 'OTHER'] as const;
const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

class CreateEmployeeDocumentDto {
  @IsString() employeeId: string;
  @IsIn(DOCUMENT_TYPES) type: string;
  @IsString() title: string;
  @IsString() fileName: string;
  @IsIn(MIME_TYPES) mimeType: string;
  @IsString() contentBase64: string;
  @IsString() @IsOptional() issuedAt?: string;
  @IsString() @IsOptional() expiresAt?: string;
  @IsString() @IsOptional() notes?: string;
}

class UpdateEmployeeDocumentDto {
  @IsIn(DOCUMENT_TYPES) @IsOptional() type?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() issuedAt?: string;
  @IsString() @IsOptional() expiresAt?: string;
  @IsString() @IsOptional() notes?: string;
}

@ApiTags('HR - Employee Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Get()
  @RequirePermissions('hr:documents:read')
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Post()
  @RequirePermissions('hr:documents:write')
  create(@Req() req: any, @Body() dto: CreateEmployeeDocumentDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  @RequirePermissions('hr:documents:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEmployeeDocumentDto) {
    return this.service.update(req, id, dto);
  }

  @Get(':id/download')
  @RequirePermissions('hr:documents:read')
  async download(@Req() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.service.getFile(req, id);
    // Audit every authorized HR document delivery attempt before streaming.
    // This does not assert that the user's browser saved the file.
    await prisma.auditLog.create({
      data: {
        tenantId: doc.tenantId,
        userId: req.user.userId,
        action: 'FILE_DELIVERY_STARTED',
        entityType: 'HR_EMPLOYEE_DOCUMENT',
        entityId: doc.id,
        httpMethod: 'GET',
        httpPath: '/hr/employee-documents/:id/download',
        newValues: { sizeBytes: doc.sizeBytes, mimeType: doc.mimeType },
      },
    });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', String(doc.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    return new StreamableFile(Buffer.from(doc.content));
  }

  @Delete(':id')
  @RequirePermissions('hr:documents:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
