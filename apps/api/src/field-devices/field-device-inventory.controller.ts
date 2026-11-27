import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@scc/database';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class RegisterDeviceDto {
  @IsString() @MaxLength(100) assetTag!: string;
  @IsIn(['ANDROID','IOS']) platform!: string;
  @IsOptional() @IsString() @MaxLength(80) employeeId?: string;
  @IsOptional() @IsString() @MaxLength(80) branchId?: string;
}

/** Safe company inventory. Physical-device enrollment requires a configured MDM. */
@Controller('field-device-inventory')
@UseGuards(JwtAuthGuard)
export class FieldDeviceInventoryController {
  private access(req: any, write = false) {
    const user = req.user;
    if (!user?.tenantId || !user?.userId || !(write ? ['ADMIN'] : ['ADMIN','MANAGER','AUDITOR','READONLY']).includes(user.role)) {
      throw new ForbiddenException('Tenant management role required');
    }
    return { tenantId: user.tenantId as string, actorId: user.userId as string };
  }

  @Get()
  list(@Req() req: any) {
    const { tenantId } = this.access(req);
    return prisma.fieldManagedDevice.findMany({
      where: { tenantId },
      select: { id: true, assetTag: true, platform: true, managementState: true,
        provider: true, employeeId: true, branchId: true, lastSeenAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Post()
  async create(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const { tenantId, actorId } = this.access(req, true);
    if (!dto || ['tenantId','userId','role','managementState','provider','noticeAcknowledgedAt'].some(k => Object.prototype.hasOwnProperty.call(dto, k))) {
      throw new BadRequestException('Forbidden server-managed field');
    }
    if (typeof dto.assetTag !== 'string' || !dto.assetTag.trim() || dto.assetTag.length > 100 ||
        !['ANDROID','IOS'].includes(dto.platform)) throw new BadRequestException('Invalid asset or platform');
    if (dto.employeeId && !(await prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId }, select: { id: true } }))) {
      throw new NotFoundException('Employee not found in company');
    }
    if (dto.branchId && !(await prisma.branch.findFirst({ where: { id: dto.branchId, tenantId }, select: { id: true } }))) {
      throw new NotFoundException('Branch not found in company');
    }
    try {
      return await prisma.$transaction(async tx => {
        const device = await tx.fieldManagedDevice.create({
          data: { tenantId, assetTag: dto.assetTag.trim(), platform: dto.platform, employeeId: dto.employeeId || null,
            branchId: dto.branchId || null, managementState: 'UNCONFIGURED', provider: 'UNCONFIGURED', createdById: actorId },
          select: { id: true, assetTag: true, platform: true, managementState: true },
        });
        await tx.fieldDeviceAudit.create({ data: { tenantId, deviceId: device.id, actorUserId: actorId,
          action: 'REGISTER_ASSET', decision: 'RECORDED' } });
        return device;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Asset tag already exists in company');
      throw error;
    }
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const { tenantId } = this.access(req);
    const device = await prisma.fieldManagedDevice.findFirst({
      where: { id, tenantId },
      select: { id: true, assetTag: true, platform: true, managementState: true,
        provider: true, employeeId: true, branchId: true, assignedAt: true,
        noticeVersion: true, noticeAcknowledgedAt: true, lastSeenAt: true },
    });
    if (!device) throw new NotFoundException('Device not found in company');
    return device;
  }
}
