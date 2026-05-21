import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateFilterDto } from './dto/template-filter.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  private getTenantId(headers: Record<string, string>): string {
    return headers['x-tenant-id'] || 'demo';
  }

  @Post()
  create(
    @Body() dto: CreateTemplateDto,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.create(this.getTenantId(headers), dto);
  }

  @Get()
  findAll(
    @Query() filters: TemplateFilterDto,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.findAll(this.getTenantId(headers), filters);
  }

  @Get('categories')
  getCategories() {
    return this.templatesService.getCategories();
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.findOne(this.getTenantId(headers), id);
  }

  @Get('key/:templateKey')
  findByKey(
    @Param('templateKey') templateKey: string,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.findByKey(this.getTenantId(headers), templateKey);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.update(this.getTenantId(headers), id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers() headers: Record<string, string>,
  ) {
    return this.templatesService.remove(this.getTenantId(headers), id);
  }
}
