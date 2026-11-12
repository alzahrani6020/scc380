import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { JournalEntriesService } from './journal-entries.service';
import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';

class CreateJEDto {
  @IsString() entryNumber: string;
  @IsString() description: string;
  @IsString() @IsOptional() reference?: string;
  @IsNumber() debitAmount: number;
  @IsNumber() creditAmount: number;
  @IsString() accountId: string;
  @IsString() @IsOptional() type?: string;
  @IsDateString() @IsOptional() date?: string;
  @IsIn(['DRAFT', 'POSTED']) @IsOptional() status?: string;
}

class UpdateJEDto {
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() reference?: string;
  @IsNumber() @IsOptional() debitAmount?: number;
  @IsNumber() @IsOptional() creditAmount?: number;
  @IsString() @IsOptional() accountId?: string;
  @IsDateString() @IsOptional() date?: string;
  @IsIn(['DRAFT', 'POSTED']) @IsOptional() status?: string;
}

class ReverseJEDto {
  @IsString() entryNumber: string;
  @IsDateString() @IsOptional() date?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() reference?: string;
}

@ApiTags('Finance - Journal Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/journal-entries')
export class JournalEntriesController {
  constructor(private readonly service: JournalEntriesService) {}

  @Get()
  @RequirePermissions('erp:read')
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  @RequirePermissions('erp:read')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  @RequirePermissions('erp:write')
  create(@Req() req: any, @Body() dto: CreateJEDto) { return this.service.create(req, dto); }

  @Post(':id/reverse')
  @RequirePermissions('erp:write')
  reverse(@Req() req: any, @Param('id') id: string, @Body() dto: ReverseJEDto) {
    return this.service.reverse(req, id, dto);
  }

  @Patch(':id')
  @RequirePermissions('erp:write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateJEDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  @RequirePermissions('erp:write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
