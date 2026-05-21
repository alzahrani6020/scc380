import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JournalEntriesService } from './journal-entries.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateJEDto {
  @IsString() entryNumber: string;
  @IsString() description: string;
  @IsString() @IsOptional() reference?: string;
  @IsNumber() debitAmount: number;
  @IsNumber() creditAmount: number;
  @IsString() accountId: string;
  @IsString() @IsOptional() type?: string;
}

class UpdateJEDto {
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() debitAmount?: number;
  @IsNumber() @IsOptional() creditAmount?: number;
  @IsString() @IsOptional() status?: string;
}

@ApiTags('Finance - Journal Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/journal-entries')
export class JournalEntriesController {
  constructor(private readonly service: JournalEntriesService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateJEDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateJEDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
