import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { prisma } from '@scc/database';

@Injectable()
export class ActivityReminderService {
  private readonly logger = new Logger(ActivityReminderService.name);
  private readonly db: PrismaClient;

  constructor(@Optional() @Inject('CRM_REMINDER_DB') db?: PrismaClient) {
    this.db = db ?? prisma;
  }

  @Cron('0 * * * * *')
  async deliverDueReminders() {
    const due = await this.db.activity.findMany({
      where: {
        reminded: false,
        remindAt: { lte: new Date() },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        assignedToId: true,
        subject: true,
        scheduledAt: true,
      },
      take: 100,
      orderBy: { remindAt: 'asc' },
    });

    for (const activity of due) {
      try {
        await this.db.$transaction(async (tx: any) => {
          const claimed = await tx.activity.updateMany({
            where: { id: activity.id, reminded: false },
            data: { reminded: true },
          });
          if (claimed.count !== 1 || !activity.assignedToId) return;

          await tx.notification.create({
            data: {
              tenantId: activity.tenantId,
              userId: activity.assignedToId,
              title: 'تذكير بنشاط CRM',
              body: activity.scheduledAt
                ? `${activity.subject} — ${activity.scheduledAt.toISOString()}`
                : activity.subject,
              type: 'CRM_ACTIVITY_REMINDER',
              channel: 'IN_APP',
              status: 'PENDING',
            },
          });
        });
      } catch (error: any) {
        this.logger.error(`CRM reminder failed for ${activity.id}: ${error?.message || error}`);
      }
    }
  }
}
