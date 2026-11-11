import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { NotificationsService } from './notifications.service';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

class CreateNotificationDto {
  @IsString() @MaxLength(50) userId: string;
  @IsString() @MaxLength(150) title: string;
  @IsString() @MaxLength(2000) body: string;
  @IsString() @MaxLength(50) @IsOptional() type?: string;
  @IsString() @MaxLength(30) @IsOptional() channel?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications:read')
  findAll(@Req() req: any, @Query() query: ListNotificationsQueryDto) {
    return this.service.findAll(req, query);
  }

  @Get('unread-count')
  @RequirePermissions('notifications:read')
  getUnreadCount(@Req() req: any) {
    return this.service.getUnreadCount(req);
  }

  @Post()
  @RequirePermissions('notifications:admin')
  create(@Req() req: any, @Body() dto: CreateNotificationDto) {
    return this.service.create(req, dto);
  }

  @Post(':id/read')
  @RequirePermissions('notifications:read')
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.service.markAsRead(req, id);
  }

  @Post('read-all')
  @RequirePermissions('notifications:read')
  markAllAsRead(@Req() req: any) {
    return this.service.markAllAsRead(req);
  }

  @Delete(':id')
  @RequirePermissions('notifications:read')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
