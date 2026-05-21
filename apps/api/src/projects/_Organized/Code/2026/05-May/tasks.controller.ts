import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateTaskDto {
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsNumber() @IsOptional() estimatedHours?: number;
  @IsString() @IsOptional() parentId?: string;
}

class UpdateTaskDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() completedAt?: string;
  @IsNumber() @IsOptional() actualHours?: number;
  @IsString() @IsOptional() boardColumn?: string;
}

@ApiTags('Projects - Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }

  @Get('kanban/board')
  getKanban(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.service.getKanban(req, projectId);
  }
}
