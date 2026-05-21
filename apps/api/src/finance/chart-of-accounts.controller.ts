import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

class CreateCoADto {
  @IsString() code: string;
  @IsString() name: string;
  @IsString() type: string;
  @IsString() @IsOptional() parentId?: string;
  @IsNumber() @IsOptional() balance?: number;
}

class UpdateCoADto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() type?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

@ApiTags('Finance - Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/chart-of-accounts')
export class ChartOfAccountsController {
  constructor(private readonly service: ChartOfAccountsService) {}

  @Get()
  findAll(@Req() req: any, @Query('type') type?: string) { return this.service.findAll(req, type); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateCoADto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCoADto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
