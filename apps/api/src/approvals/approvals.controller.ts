import { Controller, Post, Get, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalsService, EntityType } from './approvals.service';

@ApiTags('Approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get('pending')
  async getPending(@Request() req: any) {
    return this.service.getPendingApprovals(req.user.tenantId, req.user.role);
  }

  @Get('my-requests')
  async getMyRequests(@Request() req: any) {
    return this.service.getMyRequests(req.user.userId, req.user.tenantId, req.user.role);
  }

  @Post(':entityType/:id/approve')
  async approve(
    @Param('entityType') entityType: EntityType,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.approve(entityType, id, req.user.userId, req.user.tenantId, req.user.role);
  }

  @Post(':entityType/:id/reject')
  async reject(
    @Param('entityType') entityType: EntityType,
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.service.reject(entityType, id, req.user.userId, body.reason, req.user.tenantId, req.user.role);
  }
}
