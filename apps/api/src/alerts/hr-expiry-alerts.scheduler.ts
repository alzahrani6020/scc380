import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SmartAlertsService } from './alerts.service';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 15 * 1000;

@Injectable()
export class HrExpiryAlertsScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HrExpiryAlertsScheduler.name);
  private interval?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly alerts: SmartAlertsService) {}

  onApplicationBootstrap() {
    this.startupTimer = setTimeout(() => {
      void this.run('startup');
    }, STARTUP_DELAY_MS);

    this.interval = setInterval(() => {
      void this.run('interval');
    }, SIX_HOURS_MS);

    this.interval.unref?.();
    this.startupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.interval) clearInterval(this.interval);
  }

  private async run(trigger: 'startup' | 'interval') {
    if (this.running) {
      this.logger.warn(`Skipping HR expiry alert run (${trigger}) because a previous run is still active`);
      return;
    }

    this.running = true;
    try {
      const result = await this.alerts.generateHrExpiryAlertsForAllTenants();
      this.logger.log(
        `HR expiry alerts generated (${trigger}); processedTenants=${result.processedTenants}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`HR expiry alert generation failed (${trigger}): ${message}`);
    } finally {
      this.running = false;
    }
  }
}
