import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { prisma } from '@scc/database';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async enforceRetentionPolicy() {
    this.logger.log('[Retention] Checking expired records...');

    const now = new Date();

    // Mark invoices beyond 6-year retention as archived
    const archived = await prisma.invoice.updateMany({
      where: {
        retentionUntil: { lt: now },
        status: { not: 'ARCHIVED' },
      },
      data: { status: 'ARCHIVED' },
    });

    if (archived.count > 0) {
      this.logger.log(`[Retention] Archived ${archived.count} expired invoices`);
    }

    // Log retention stats
    const total = await prisma.invoice.count({
      where: { retentionUntil: { lt: now } },
    });

    this.logger.log(`[Retention] Total archived records: ${total}`);
  }
}
