import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { IsString, IsOptional } from 'class-validator';

class CreateNotificationDto {
  @IsString() userId: string;
  @IsString() title: string;
  @IsString() body: string;
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() channel?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) { return this.service.findAll(req, query); }

  @Get('unread-count')
  getUnreadCount(@Req() req: any) { return this.service.getUnreadCount(req); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateNotificationDto) { return this.service.create(req, dto); }

  @Post(':id/read')
  markAsRead(@Req() req: any, @Param('id') id: string) { return this.service.markAsRead(req, id); }

  @Post('read-all')
  markAllAsRead(@Req() req: any) { return this.service.markAllAsRead(req); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }
}
