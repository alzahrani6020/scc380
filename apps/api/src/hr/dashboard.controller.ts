import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { HrDashboardService } from './dashboard.service';

@ApiTags('HR - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/dashboard')
export class HrDashboardController {
  constructor(private readonly service: HrDashboardService) {}

  @Get()
  @RequirePermissions('hr:read')
  getSummary(@Req() req: any) {
    return this.service.getSummary(req);
  }
}
