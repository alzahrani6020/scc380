import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable,
  NotFoundException, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { prisma } from '@scc/database';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SiteDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsIn(['BRANCH', 'OFFICE', 'WAREHOUSE', 'SITE']) siteType?: string;
  @IsOptional() @IsString() @MaxLength(80) branchId?: string;
}

class CameraDto {
  @IsString() @MaxLength(80) siteId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(100) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsBoolean() isOutdoor?: boolean;
  @IsOptional() @IsBoolean() supportsAudio?: boolean;
  @IsOptional() @IsBoolean() supportsTalk?: boolean;
  @IsOptional() @IsBoolean() supportsPtz?: boolean;
  @IsOptional() @IsBoolean() supportsWiper?: boolean;
}

class MaintenanceDto {
  @IsString() @MaxLength(80) cameraId!: string;
  @IsIn(['CLEANING', 'LENS_CHECK', 'PTZ_CHECK', 'RECORDING_CHECK', 'REPAIR']) taskType!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

class MaintenanceDecisionDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']) status!: string;
}

@Injectable()
@Controller('surveillance')
@UseGuards(JwtAuthGuard)
export class SurveillanceController {
  // Never trust X-Tenant-Id, query-string tenantId, a branch selector, or client-supplied role.
  private scope(req: any, write = false): { tenantId: string; userId: string } {
    const role = req.user?.role;
    const allowed = write ? ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] :
      ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AUDITOR', 'READONLY'];
    if (!allowed.includes(role)) throw new ForbiddenException('Surveillance role not authorized');
    const tenantId = req.user?.tenantId;
    if (!tenantId || !req.user?.userId) {
      throw new ForbiddenException('An authenticated tenant context is required');
    }
    return { tenantId, userId: req.user.userId };
  }

  private rejectClientScope(value: object) {
    if (Object.prototype.hasOwnProperty.call(value, 'tenantId') ||
        Object.prototype.hasOwnProperty.call(value, 'role') ||
        Object.prototype.hasOwnProperty.call(value, 'userId')) {
      throw new BadRequestException('Tenant and role are controlled by the authenticated session');
    }
  }

  private checkText(value: string, label: string) {
    if (!value?.trim()) throw new BadRequestException(label + ' is required');
    return value.trim();
  }

  @Get('sites')
  sites(@Req() req: any) {
    const { tenantId } = this.scope(req);
    return prisma.surveillanceSite.findMany({
      where: { tenantId },
      select: { id: true, name: true, city: true, address: true, siteType: true,
        branchId: true, createdAt: true, _count: { select: { cameras: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Post('sites')
  async addSite(@Req() req: any, @Body() dto: SiteDto) {
    const { tenantId } = this.scope(req, true);
    this.rejectClientScope(dto);
    if (dto.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, tenantId }, select: { id: true } });
      if (!branch) throw new NotFoundException('Branch not found in tenant');
    }
    return prisma.surveillanceSite.create({
      data: { tenantId, name: this.checkText(dto.name, 'Site name'), city: dto.city,
        address: dto.address, siteType: dto.siteType ?? 'BRANCH', branchId: dto.branchId },
    });
  }

  @Get('cameras')
  cameras(@Req() req: any) {
    const { tenantId } = this.scope(req);
    return prisma.surveillanceCamera.findMany({
      where: { tenantId },
      select: { id: true, siteId: true, name: true, manufacturer: true, model: true,
        serialNumber: true, location: true, isOutdoor: true, supportsAudio: true,
        supportsTalk: true, supportsPtz: true, supportsWiper: true,
        connectionStatus: true, createdAt: true,
        site: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Post('cameras')
  async addCamera(@Req() req: any, @Body() dto: CameraDto) {
    const { tenantId } = this.scope(req, true);
    this.rejectClientScope(dto);
    const site = await prisma.surveillanceSite.findFirst({ where: { id: dto.siteId, tenantId }, select: { id: true } });
    if (!site) throw new NotFoundException('Site not found in tenant');
    if (dto.supportsTalk && !dto.supportsAudio) {
      throw new BadRequestException('Two-way audio requires audio support');
    }
    return prisma.surveillanceCamera.create({
      data: { tenantId, siteId: site.id, name: this.checkText(dto.name, 'Camera name'),
        manufacturer: dto.manufacturer, model: dto.model, serialNumber: dto.serialNumber,
        location: dto.location, isOutdoor: dto.isOutdoor ?? false,
        supportsAudio: dto.supportsAudio ?? false, supportsTalk: dto.supportsTalk ?? false,
        supportsPtz: dto.supportsPtz ?? false, supportsWiper: dto.supportsWiper ?? false,
        connectionStatus: 'UNCONFIGURED' },
    });
  }

  @Get('maintenance')
  maintenance(@Req() req: any) {
    const { tenantId } = this.scope(req);
    return prisma.surveillanceMaintenance.findMany({
      where: { tenantId },
      select: { id: true, cameraId: true, taskType: true, description: true, status: true,
        createdAt: true, completedAt: true,
        camera: { select: { name: true, site: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Post('maintenance')
  async addMaintenance(@Req() req: any, @Body() dto: MaintenanceDto) {
    const { tenantId, userId } = this.scope(req, true);
    this.rejectClientScope(dto);
    const camera = await prisma.surveillanceCamera.findFirst({
      where: { id: dto.cameraId, tenantId }, select: { id: true },
    });
    if (!camera) throw new NotFoundException('Camera not found in tenant');
    return prisma.surveillanceMaintenance.create({
      data: { tenantId, cameraId: camera.id, taskType: dto.taskType,
        description: dto.description, createdById: userId },
    });
  }

  @Patch('maintenance/:id')
  async updateMaintenance(@Req() req: any, @Param('id') id: string,
      @Body() dto: MaintenanceDecisionDto) {
    const { tenantId } = this.scope(req, true);
    const existing = await prisma.surveillanceMaintenance.findFirst({
      where: { id, tenantId }, select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Maintenance not found in tenant');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BadRequestException('Closed maintenance records cannot be changed');
    }
    return prisma.surveillanceMaintenance.update({
      where: { id },
      data: { status: dto.status,
        completedAt: dto.status === 'COMPLETED' ? new Date() : null },
    });
  }

  // Not implemented: media credentials, outbound audio, PTZ, recordings.
  // These require verified device capabilities and an independently secured gateway.
}
