import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { prisma, withTenant } from '@scc/database';

@Injectable()
export class EjarService {
  private readonly logger = new Logger(EjarService.name);
  private readonly baseUrl = process.env.EJAR_API_URL || 'https://api.ejar.sa/v1';
  private readonly apiKey = process.env.EJAR_API_KEY || '';

  private assertConfigured() {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('Ejar integration is not configured; no verification or registration was performed');
    }
  }

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
    if (!contract) throw new NotFoundException('Contract not found');

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

    this.assertConfigured();

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
    this.assertConfigured();
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
    this.assertConfigured();
    const contract = await prisma.leaseContract.findFirst({
      where: withTenant({ id: contractId }, tenantId),
      select: { id: true, ejarContractNumber: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.ejarContractNumber) throw new ServiceUnavailableException('Contract has no registered Ejar contract number');
    const payments = await prisma.rentPayment.findMany({
      where: withTenant({ contractId, status: 'COMPLETED' }, tenantId),
    });

    this.assertConfigured();

    try {
      const res = await fetch(`${this.baseUrl}/contracts/${encodeURIComponent(contract.ejarContractNumber)}/payments`, {
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
