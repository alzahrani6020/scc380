import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpensesService } from './expenses.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateExpenseDto {
  @IsString() category: string;
  @IsNumber() amount: number;
  @IsString() description: string;
  @IsString() @IsOptional() receiptUrl?: string;
  @IsString() @IsOptional() incurredAt?: string;
}

class UpdateExpenseDto {
  @IsString() @IsOptional() category?: string;
  @IsNumber() @IsOptional() amount?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() approvedById?: string;
}

@ApiTags('Finance - Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateExpenseDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
