import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { IsString, IsOptional } from 'class-validator';

class CreateConversationDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() model?: string;
  @IsString() @IsOptional() context?: string;
}

class CreateMessageDto {
  @IsString() content: string;
  @IsString() @IsOptional() role?: string;
}

@ApiTags('AI - Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findAll(@Req() req: any) { return this.service.findAll(req); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req, id); }

  @Post()
  create(@Req() req: any, @Body() dto: CreateConversationDto) { return this.service.create(req, dto); }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req, id); }

  @Post(':id/messages')
  addMessage(@Req() req: any, @Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.service.addMessage(req, id, dto);
  }

  @Get(':id/messages')
  getMessages(@Req() req: any, @Param('id') id: string) {
    return this.service.getMessages(req, id);
  }
}
