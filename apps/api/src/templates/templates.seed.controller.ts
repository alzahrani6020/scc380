import { Controller, Post, Headers } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { seedTemplates } from './data/templates.seed';

@Controller('templates/seed')
export class TemplatesSeedController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  async seed(@Headers('x-tenant-id') tenantId: string) {
    const tId = tenantId || null;
    const results = [];
    for (const tpl of seedTemplates) {
      try {
        const existing = await this.templatesService.findAll(tId, { templateKey: tpl.templateKey } as any);
        if (existing.length > 0) {
          results.push({ key: tpl.templateKey, status: 'skipped' });
          continue;
        }
      } catch {
        // ignore
      }
      try {
        await this.templatesService.create(tId, tpl as any);
        results.push({ key: tpl.templateKey, status: 'created' });
      } catch (err: any) {
        results.push({ key: tpl.templateKey, status: 'error', message: err.message });
      }
    }
    return { seeded: results.length, results };
  }
}
