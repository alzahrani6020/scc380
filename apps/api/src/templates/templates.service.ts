import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateFilterDto } from './dto/template-filter.dto';

@Injectable()
export class TemplatesService {
  async create(tenantId: string | null, dto: CreateTemplateDto) {
    return prisma.template.create({
      data: {
        ...dto,
        tenantId: tenantId || null,
        category: dto.category as any,
      },
    });
  }

  async findAll(tenantId: string, filters: TemplateFilterDto) {
    const where: any = tenantId ? { tenantId } : { tenantId: null };
    if (filters.category) where.category = filters.category;
    if (filters.subcategory) where.subcategory = filters.subcategory;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isSystem !== undefined) where.isSystem = filters.isSystem;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { nameAr: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { templateKey: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.template.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await prisma.template.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async findByKey(tenantId: string, templateKey: string) {
    const template = await prisma.template.findFirst({
      where: { templateKey, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(tenantId: string, id: string, dto: UpdateTemplateDto) {
    await this.findOne(tenantId, id);
    return prisma.template.update({
      where: { id },
      data: {
        ...dto,
        category: dto.category as any,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return prisma.template.delete({ where: { id } });
  }

  async getCategories() {
    return [
      { key: 'HR', label: 'الموارد البشرية', labelEn: 'Human Resources', icon: 'Users', count: 0 },
      { key: 'ACCOUNTING', label: 'المحاسبة والمالية', labelEn: 'Accounting & Finance', icon: 'Calculator', count: 0 },
      { key: 'ADMIN', label: 'الإدارة والتشغيل', labelEn: 'Administration & Operations', icon: 'Building2', count: 0 },
      { key: 'LEGAL', label: 'العقود والقانونية', labelEn: 'Legal & Contracts', icon: 'Scale', count: 0 },
      { key: 'FLEET', label: 'الأسطول واللوجستيات', labelEn: 'Fleet & Logistics', icon: 'Truck', count: 0 },
      { key: 'SALES', label: 'المبيعات والتسويق', labelEn: 'Sales & Marketing', icon: 'TrendingUp', count: 0 },
      { key: 'PROJECTS', label: 'المشاريع', labelEn: 'Projects', icon: 'Kanban', count: 0 },
    ];
  }
}
