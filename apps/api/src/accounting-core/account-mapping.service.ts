import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma, prisma } from '@scc/database';

export type AccountingRole =
  | 'CASH'
  | 'ACCOUNTS_RECEIVABLE'
  | 'INVENTORY'
  | 'FIXED_ASSETS'
  | 'ACCOUNTS_PAYABLE'
  | 'VAT_PAYABLE'
  | 'VAT_RECEIVABLE'
  | 'SALES_REVENUE'
  | 'COGS'
  | 'PAYROLL_EXPENSE'
  | 'GENERAL_EXPENSE';

const DEFAULT_CODES: Record<AccountingRole, string> = {
  CASH: '1110',
  ACCOUNTS_RECEIVABLE: '1120',
  INVENTORY: '1130',
  FIXED_ASSETS: '1200',
  ACCOUNTS_PAYABLE: '2100',
  VAT_PAYABLE: '2110',
  VAT_RECEIVABLE: '1140',
  SALES_REVENUE: '4100',
  COGS: '5600',
  PAYROLL_EXPENSE: '5200',
  GENERAL_EXPENSE: '5000',
};

type DbClient = Prisma.TransactionClient | typeof prisma;

@Injectable()
export class AccountMappingService {
  private readAccounting(settings: unknown): Record<string, any> {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    const accounting = (settings as any).accounting;
    if (!accounting || typeof accounting !== 'object' || Array.isArray(accounting)) return {};
    return accounting as Record<string, any>;
  }

  private readOverrides(settings: unknown): Partial<Record<AccountingRole, string>> {
    const mapping = this.readAccounting(settings).accountMapping;
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return {};
    return mapping as Partial<Record<AccountingRole, string>>;
  }

  private async loadTenant(client: DbClient, tenantId: string) {
    const tenant = await client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');
    return tenant;
  }

  private async resolveWithClient(client: DbClient, tenantId: string, roles: AccountingRole[]) {
    const tenant = await this.loadTenant(client, tenantId);
    const overrides = this.readOverrides(tenant.settings);
    const requested = [...new Set(roles)];
    const codeByRole = Object.fromEntries(
      requested.map(role => [role, overrides[role] || DEFAULT_CODES[role]]),
    ) as Record<AccountingRole, string>;

    const codes = [...new Set(Object.values(codeByRole))];
    const accounts = await client.chartOfAccount.findMany({
      where: { tenantId, code: { in: codes }, isActive: true },
      select: { id: true, code: true, name: true, type: true },
    });
    const byCode = new Map(accounts.map(account => [account.code, account]));

    const missing = requested.filter(role => !byCode.has(codeByRole[role]));
    if (missing.length) {
      throw new BadRequestException(
        `Missing active accounting mappings: ${missing
          .map(role => `${role}=${codeByRole[role]}`)
          .join(', ')}`,
      );
    }

    return Object.fromEntries(
      requested.map(role => [role, byCode.get(codeByRole[role])!]),
    ) as Record<AccountingRole, { id: string; code: string; name: string; type: string }>;
  }


  private paymentMethodCode(settings: unknown, method: PaymentMethod) {
    const mapping = this.readAccounting(settings).paymentMethodMapping;
    if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
      const configured = (mapping as Record<string, unknown>)[method];
      if (typeof configured === 'string' && configured.trim()) return configured.trim();
    }
    if (method === PaymentMethod.CASH) return DEFAULT_CODES.CASH;
    throw new BadRequestException(
      `Missing accounting payment-method mapping for ${method}`,
    );
  }

  async resolvePaymentAccountInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    method: PaymentMethod,
  ) {
    const tenant = await this.loadTenant(tx, tenantId);
    const code = this.paymentMethodCode(tenant.settings, method);
    const account = await tx.chartOfAccount.findFirst({
      where: { tenantId, code, isActive: true },
      select: { id: true, code: true, name: true, type: true },
    });
    if (!account) {
      throw new BadRequestException(
        `Missing active payment account mapping: ${method}=${code}`,
      );
    }
    return account;
  }

  async isAutoPostingEnabled(tenantId: string) {
    const tenant = await this.loadTenant(prisma, tenantId);
    return this.readAccounting(tenant.settings).autoPostingEnabled === true;
  }

  async isAutoPostingEnabledInTransaction(tx: Prisma.TransactionClient, tenantId: string) {
    const tenant = await this.loadTenant(tx, tenantId);
    return this.readAccounting(tenant.settings).autoPostingEnabled === true;
  }

  async resolve(tenantId: string, roles: AccountingRole[]) {
    return this.resolveWithClient(prisma, tenantId, roles);
  }

  async resolveInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    roles: AccountingRole[],
  ) {
    return this.resolveWithClient(tx, tenantId, roles);
  }
}
