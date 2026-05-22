import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { prisma } from '@scc/database';

interface ZatcaApiConfig {
  baseUrl: string;
  csid: string;
  secretKey: string;
}

@Injectable()
export class ZatcaApiClient {
  private readonly logger = new Logger(ZatcaApiClient.name);

  private getConfig(tenantId: string): Promise<ZatcaApiConfig> {
    return prisma.zatcaCredential.findUnique({
      where: { tenantId },
    }).then(cred => {
      if (!cred || cred.status !== 'ACTIVE') {
        throw new Error('ZATCA credentials not active');
      }
      const baseUrl = cred.environment === 'PRODUCTION'
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
      return { baseUrl, csid: cred.csid!, secretKey: cred.secretKey! };
    });
  }

  private getAuthHeader(csid: string, secretKey: string): string {
    const token = Buffer.from(`${csid}:${secretKey}`).toString('base64');
    return `Basic ${token}`;
  }

  async sendClearance(tenantId: string, xml: string): Promise<{ success: boolean; clearedXml?: string; error?: string }> {
    const config = await this.getConfig(tenantId);
    const url = `${config.baseUrl}/invoices/clearance/invoices`;

    try {
      this.logger.log(`[ZATCA] Sending clearance to ${url}`);
      const response = await axios.post(url, xml, {
        headers: {
          'Content-Type': 'application/xml',
          Authorization: this.getAuthHeader(config.csid, config.secretKey),
          'Accept-Language': 'en',
        },
        timeout: 60000,
      });

      this.logger.log(`[ZATCA] Clearance success: ${response.status}`);
      return {
        success: true,
        clearedXml: response.data?.clearedInvoice || xml,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`[ZATCA] Clearance failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  async sendReporting(tenantId: string, xml: string): Promise<{ success: boolean; reportingId?: string; error?: string }> {
    const config = await this.getConfig(tenantId);
    const url = `${config.baseUrl}/invoices/reporting/invoices`;

    try {
      this.logger.log(`[ZATCA] Sending reporting to ${url}`);
      const response = await axios.post(url, xml, {
        headers: {
          'Content-Type': 'application/xml',
          Authorization: this.getAuthHeader(config.csid, config.secretKey),
          'Accept-Language': 'en',
        },
        timeout: 60000,
      });

      this.logger.log(`[ZATCA] Reporting success: ${response.status}`);
      return {
        success: true,
        reportingId: response.data?.reportingId || response.data?.uuid,
      };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`[ZATCA] Reporting failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 2000,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      this.logger.warn(`[ZATCA] Retry after ${delay}ms, ${retries} left`);
      await new Promise(r => setTimeout(r, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }
}
