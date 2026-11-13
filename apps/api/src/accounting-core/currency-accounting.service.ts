import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, prisma } from '@scc/database';

type DbClient = Prisma.TransactionClient | typeof prisma;

@Injectable()
export class CurrencyAccountingService {
  normalizeCurrency(value: string | null | undefined) {
    const currency = String(value || 'SAR').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }
    return currency;
  }

  decimalRate(value: Prisma.Decimal.Value) {
    const rate = new Prisma.Decimal(value);
    if (!rate.gt(0)) throw new BadRequestException('Exchange rate must be greater than zero');
    return rate;
  }

  async getTenantConfig(client: DbClient, tenantId: string) {
    const tenant = await client.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        baseCurrency: true,
        fxGainAccountId: true,
        fxLossAccountId: true,
      },
    });
    if (!tenant) throw new BadRequestException('Tenant not found');
    return {
      ...tenant,
      baseCurrency: this.normalizeCurrency(tenant.baseCurrency),
    };
  }

  async resolveRateInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    currency: string,
    at: Date,
    suppliedRate?: Prisma.Decimal.Value,
  ) {
    const config = await this.getTenantConfig(tx, tenantId);
    const transactionCurrency = this.normalizeCurrency(currency);
    const baseCurrency = this.normalizeCurrency(config.baseCurrency);

    if (transactionCurrency === baseCurrency) {
      if (suppliedRate !== undefined && !this.decimalRate(suppliedRate).equals(1)) {
        throw new BadRequestException('Base-currency exchange rate must equal 1');
      }
      return {
        transactionCurrency,
        baseCurrency,
        exchangeRate: new Prisma.Decimal(1),
      };
    }

    if (suppliedRate !== undefined) {
      return {
        transactionCurrency,
        baseCurrency,
        exchangeRate: this.decimalRate(suppliedRate),
      };
    }

    const direct = await tx.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: transactionCurrency,
        toCurrency: baseCurrency,
        effectiveDate: { lte: at },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    if (direct) {
      return {
        transactionCurrency,
        baseCurrency,
        exchangeRate: new Prisma.Decimal(direct.rate),
      };
    }

    const inverse = await tx.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: baseCurrency,
        toCurrency: transactionCurrency,
        effectiveDate: { lte: at },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    if (inverse) {
      return {
        transactionCurrency,
        baseCurrency,
        exchangeRate: new Prisma.Decimal(1).div(inverse.rate),
      };
    }

    throw new BadRequestException(
      `No exchange rate found for ${transactionCurrency}/${baseCurrency} at transaction date`,
    );
  }

  convert(amount: Prisma.Decimal.Value, rate: Prisma.Decimal.Value) {
    return new Prisma.Decimal(amount)
      .mul(new Prisma.Decimal(rate))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  async resolveFxAccountsInTransaction(tx: Prisma.TransactionClient, tenantId: string) {
    const config = await this.getTenantConfig(tx, tenantId);
    if (!config.fxGainAccountId || !config.fxLossAccountId) {
      throw new BadRequestException(
        'FX gain/loss accounts are not configured for this tenant',
      );
    }

    const accounts = await tx.chartOfAccount.findMany({
      where: {
        tenantId,
        id: { in: [config.fxGainAccountId, config.fxLossAccountId] },
        isActive: true,
      },
      select: { id: true, type: true, code: true, name: true },
    });
    const gain = accounts.find((account) => account.id === config.fxGainAccountId);
    const loss = accounts.find((account) => account.id === config.fxLossAccountId);

    if (!gain || gain.type !== 'REVENUE') {
      throw new BadRequestException('Configured FX gain account must be active REVENUE');
    }
    if (!loss || loss.type !== 'EXPENSE') {
      throw new BadRequestException('Configured FX loss account must be active EXPENSE');
    }

    return { gain, loss };
  }
}
