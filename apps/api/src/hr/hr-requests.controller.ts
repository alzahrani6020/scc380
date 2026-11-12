import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { HrRequestsService } from './hr-requests.service';

const HR_REQUEST_TYPES = ['EMPLOYMENT_CERTIFICATE','SALARY_CERTIFICATE','LETTER','DATA_CORRECTION','BENEFIT_INQUIRY','OTHER'] as const;

class CreateSelfHrRequestDto {
  @IsIn([...HR_REQUEST_TYPES]) type: string;
  @IsString() @MaxLength(160) subject: string;
  @IsObject() @IsOptional() details?: Record<string, unknown>;
}
class ReviewHrRequestDto {
  @IsString() @MaxLength(1000) @IsOptional() resolution?: string;
}

@ApiTags('HR - Requests Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/requests')
export class HrRequestsController {
  constructor(private readonly service: HrRequestsService) {}

  @Get()
  @RequirePermissions('hr:read')
  list(@Req() req: any, @Query() query: any) { return this.service.listAdmin(req, query); }

  @Post(':id/approve')
  @RequirePermissions('hr:write')
  approve(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewHrRequestDto) {
    return this.service.review(req, id, 'APPROVED', dto.resolution);
  }

  @Post(':id/reject')
  @RequirePermissions('hr:write')
  reject(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewHrRequestDto) {
    return this.service.review(req, id, 'REJECTED', dto.resolution);
  }
}

@ApiTags('HR - Self Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/self/requests')
export class HrSelfRequestsController {
  constructor(private readonly service: HrRequestsService) {}

  @Get()
  list(@Req() req: any) { return this.service.listSelf(req); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSelfHrRequestDto) { return this.service.createSelf(req, dto); }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) { return this.service.cancelSelf(req, id); }
}
