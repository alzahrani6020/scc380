import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { BankAccountsService } from './bank-accounts.service';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

class CreateBankAccountDto {
  @IsString() bankName: string;
  @IsString() accountName: string;
  @IsString() accountNumber: string;
  @IsString() @IsOptional() iban?: string;
  @IsString() @IsOptional() swiftCode?: string;
  @IsString() @IsOptional() currency?: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsString() @IsOptional() chartAccountId?: string;
}

class UpdateBankAccountDto {
  @IsString() @IsOptional() bankName?: string;
  @IsString() @IsOptional() accountName?: string;
  @IsNumber() @IsOptional() balance?: number;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() chartAccountId?: string;
}

@ApiTags('Finance - Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/bank-accounts')
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any) { return this.service.findAll(req); }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateBankAccountDto) { return this.service.create(req, dto); }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBankAccountDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
