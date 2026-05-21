import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

class CreateSubscriptionDto {
  @IsString() userId: string;
  @IsString() plan: string;
  @IsNumber() seats: number;
  @IsNumber() pricePerSeat: number;
  @IsNumber() totalPrice: number;
  @IsString() @IsOptional() billingCycle?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
}

class UpdateSubscriptionDto {
  @IsString() @IsOptional() plan?: string;
  @IsString() @IsOptional() status?: string;
  @IsBoolean() @IsOptional() autoRenew?: boolean;
  @IsString() @IsOptional() cancelReason?: string;
}

@ApiTags('Billing - Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing/subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateSubscriptionDto) { return this.service.create(req, dto); }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) { return this.service.update(req, id, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
