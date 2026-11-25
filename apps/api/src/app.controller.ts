import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { prisma } from '@scc/database';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  // Liveness and readiness must remain separate: this endpoint confirms
  // that PostgreSQL is reachable before claiming application readiness.
  // No connection details or credentials are exposed.
  @Get('ready')
  async getReadiness() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('API not ready');
    }
  }
}
