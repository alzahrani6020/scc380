import { Injectable, Logger } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class EjarService {
  private readonly logger = new Logger(EjarService.name);
  private readonly baseUrl = process.env.EJAR_API_URL || 'https://api.ejar.sa/v1';
  private readonly apiKey = process.env.EJAR_API_KEY || '';

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async registerContract(tenantId: string, contractId: string): Promise<any> {
    const contract = await prisma.leaseContract.findFirst({
      where: withTenant({ id: contractId }, tenantId),
      include: { property: true, unit: true },
    });
    if (!contract) throw new Error('Contract not found');

    const payload = {
      contractNumber: contract.ejarContractNumber || `SCC-${contract.id.slice(-6)}`,
      contractType: contract.contractType,
      lessor: {
        name: contract.lessorName,
        idNumber: contract.lessorIdNumber,
        phone: contract.lessorPhone,
      },
      lessee: {
        name: contract.lesseeName,
        idNumber: contract.lesseeIdNumber,
        phone: contract.lesseePhone,
      },
      property: {
        deedNumber: contract.property.deedNumber,
        address: contract.property.address,
        city: contract.property.city,
      },
      unit: {
        unitNumber: contract.unit.unitNumber,
        areaSqm: contract.unit.areaSqm,
      },
      startDate: contract.startDate.toISOString(),
      endDate: contract.endDate.toISOString(),
      rentAmount: Number(contract.rentAmount),
      paymentFrequency: contract.paymentFrequency,
    };

    if (!this.apiKey) {
      this.logger.warn(`[EJAR DEMO] registerContract: ${JSON.stringify(payload)}`);
      await prisma.leaseContract.update({
        where: { id: contractId },
        data: { ejarStatus: 'REGISTERED', ejarSyncedAt: new Date() },
      });
      return { success: true, ejarContractNumber: payload.contractNumber, demo: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/contracts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Ejar registration failed');
      await prisma.leaseContract.update({
        where: { id: contractId },
        data: { ejarStatus: 'REGISTERED', ejarSyncedAt: new Date() },
      });
      this.logger.log(`Ejar registered contract ${contractId}`);
      return data;
    } catch (err: any) {
      this.logger.error(`Ejar registerContract failed: ${err.message}`);
      throw err;
    }
  }

  async verifyIdentity(idNumber: string): Promise<any> {
    if (!this.apiKey) {
      this.logger.warn(`[EJAR DEMO] verifyIdentity: ${idNumber}`);
      return { idNumber, verified: true, fullName: 'محمد عبدالله', demo: true };
    }
    try {
      const res = await fetch(`${this.baseUrl}/identity/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ idNumber }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Identity verification failed');
      return data;
    } catch (err: any) {
      this.logger.error(`Ejar verifyIdentity failed: ${err.message}`);
      throw err;
    }
  }

  async syncPayments(tenantId: string, contractId: string): Promise<any> {
    const payments = await prisma.rentPayment.findMany({
      where: withTenant({ contractId, status: 'PAID' }, tenantId),
    });

    if (!this.apiKey) {
      this.logger.warn(`[EJAR DEMO] syncPayments: ${payments.length} payments`);
      return { success: true, syncedCount: payments.length, demo: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/contracts/${contractId}/payments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ payments: payments.map((p) => ({ ref: p.transactionRef, amount: Number(p.amount), date: p.paidDate })) }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || 'Ejar payment sync failed');
      return data;
    } catch (err: any) {
      this.logger.error(`Ejar syncPayments failed: ${err.message}`);
      throw err;
    }
  }
}
