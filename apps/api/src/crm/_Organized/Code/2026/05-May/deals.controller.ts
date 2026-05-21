import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DealsService } from './deals.service';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

class CreateDealDto {
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() contactId: string;
  @IsNumber() @IsOptional() value?: number;
  @IsString() @IsOptional() currency?: string;
  @IsString() @IsOptional() stage?: string;
  @IsNumber() @IsOptional() probability?: number;
  @IsString() @IsOptional() expectedClose?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

class UpdateDealDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() contactId?: string;
  @IsNumber() @IsOptional() value?: number;
  @IsString() @IsOptional() currency?: string;
  @IsString() @IsOptional() stage?: string;
  @IsNumber() @IsOptional() probability?: number;
  @IsString() @IsOptional() expectedClose?: string;
  @IsString() @IsOptional() assignedToId?: string;
}

@ApiTags('CRM - Deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/deals')
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Get()
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateDealDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
