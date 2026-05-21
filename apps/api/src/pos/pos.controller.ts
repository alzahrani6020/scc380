import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PosService } from './pos.service';
import { CreatePosOrderDto, CreatePosSessionDto, ClosePosSessionDto } from './dto/pos.dto';

@ApiTags('POS')
@Controller('pos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PosController {
  constructor(private service: PosService) {}

  // ─── Sessions ───
  @Get('session/active')
  getActiveSession(@Request() req: any) {
    return this.service.findActiveSession(req.user.id, req.user.tenantId, req.user.role);
  }

  @Post('session/open')
  openSession(@Body() dto: CreatePosSessionDto, @Request() req: any) {
    return this.service.openSession(dto, req.user.id, req.user.tenantId, req.user.role);
  }

  @Post('session/:id/close')
  closeSession(@Param('id') id: string, @Body() dto: ClosePosSessionDto, @Request() req: any) {
    return this.service.closeSession(id, dto, req.user.tenantId, req.user.role);
  }

  // ─── Orders ───
  @Get('orders')
  findAllOrders(@Request() req: any) {
    return this.service.findAllOrders(req.user.tenantId, req.user.role);
  }

  @Get('orders/:id')
  findOrder(@Param('id') id: string, @Request() req: any) {
    return this.service.findOrderById(id, req.user.tenantId, req.user.role);
  }

  @Post('orders')
  createOrder(@Body() dto: CreatePosOrderDto, @Request() req: any) {
    return this.service.createOrder(dto, req.user.id, req.user.tenantId, req.user.role);
  }

  // ─── Reports ───
  @Get('reports/daily')
  getDailyReport(@Request() req: any, @Param('date') date?: string) {
    return this.service.getDailyReport(req.user.tenantId, req.user.role, date);
  }
}
