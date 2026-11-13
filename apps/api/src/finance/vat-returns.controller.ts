import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { VatReturnsService } from './vat-returns.service';

class CreateVatReturnDto {
  @IsDateString() periodStart: string;
  @IsDateString() periodEnd: string;
}

class VatSettlementConfigDto {
  @IsString() @IsOptional() payableAccountId?: string;
  @IsString() @IsOptional() receivableAccountId?: string;
}

@ApiTags('Finance - VAT Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/vat-returns')
export class VatReturnsController {
  constructor(private readonly service: VatReturnsService) {}

  @Get()
  @RequirePermissions('erp:read')
  list(@Req() req: any) {
    return this.service.list(req.user?.tenantId);
  }

  @Get('config')
  @RequirePermissions('erp:read')
  config(@Req() req: any) {
    return this.service.getSettlementConfig(req.user?.tenantId);
  }

  @Patch('config')
  @RequirePermissions('erp:write')
  setConfig(@Req() req: any, @Body() dto: VatSettlementConfigDto) {
    return this.service.setSettlementConfig(
      req.user?.tenantId,
      dto.payableAccountId,
      dto.receivableAccountId,
    );
  }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateVatReturnDto) {
    return this.service.create(req.user?.tenantId, dto);
  }

  @Get(':id')
  @RequirePermissions('erp:read')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user?.tenantId, id);
  }

  @Get(':id/preview')
  @RequirePermissions('erp:read')
  preview(@Req() req: any, @Param('id') id: string) {
    return this.service.preview(req.user?.tenantId, id);
  }

  @Post(':id/file')
  @RequirePermissions('erp:write')
  file(@Req() req: any, @Param('id') id: string) {
    return this.service.file(req.user?.tenantId, id, req.user?.id);
  }

  @Post(':id/settle')
  @RequirePermissions('erp:write')
  settle(@Req() req: any, @Param('id') id: string) {
    return this.service.settle(req.user?.tenantId, id, req.user?.id);
  }

  @Post(':id/reverse-settlement')
  @RequirePermissions('erp:write')
  reverse(@Req() req: any, @Param('id') id: string) {
    return this.service.reverseSettlement(
      req.user?.tenantId,
      id,
      req.user?.id,
      req.user?.role,
    );
  }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.removeDraft(req.user?.tenantId, id);
  }
}
