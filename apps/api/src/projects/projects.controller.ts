import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { IsString, IsOptional, IsNumber } from 'class-validator';

class CreateProjectDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsNumber() @IsOptional() budget?: number;
  @IsString() @IsOptional() clientId?: string;
  @IsString() @IsOptional() managerId?: string;
}

class UpdateProjectDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsNumber() @IsOptional() budget?: number;
  @IsNumber() @IsOptional() progress?: number;
  @IsString() @IsOptional() clientId?: string;
  @IsString() @IsOptional() managerId?: string;
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Req() req: any, @Query() query: any) {
    return this.service.findAll(req, query);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.service.create(req, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(req, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req, id);
  }
}
