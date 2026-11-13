import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { TenantService } from './tenant.service';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private service: TenantService) {}

  @Get()
  @RequirePermissions('tenant:read')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user);
  }

  @Get(':id')
  @RequirePermissions('tenant:read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user, id);
  }

  @Post()
  @RequirePermissions('tenant:write')
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user, body);
  }

  @Patch(':id')
  @RequirePermissions('tenant:write')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user, id, body);
  }

  @Delete(':id')
  @RequirePermissions('tenant:write')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user, id);
  }
}
