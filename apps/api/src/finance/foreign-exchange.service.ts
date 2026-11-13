import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@scc/database';
import { AccountingPostingService } from '../accounting-core/accounting-posting.service';

@Injectable()
export class ForeignExchangeService {
  constructor(private readonly posting: AccountingPostingService) {}

  private currency(value: string) {
    const currency = String(value || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }
    return currency;
  }

  private date(value: string | Date, endOfDay = false) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    if (endOfDay) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private rate(value: Prisma.Decimal.Value) {
    const rate = new Prisma.Decimal(value);
    if (!rate.gt(0)) throw new BadRequestException('Exchange rate must be greater than zero');
    return rate;
  }

  private async tenantConfig(client: Prisma.TransactionClient | typeof prisma, tenantId: string) {
    const tenant = await client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, baseCurrency: true, fxGainAccountId: true, fxLossAccountId: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async getConfig(req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    return this.tenantConfig(prisma, tenantId);
  }

  async setBaseCurrency(req: any, value: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const currency = this.currency(value);
    const tenant = await this.tenantConfig(prisma, tenantId);
    if (tenant.baseCurrency === currency) return tenant;

    const posted = await prisma.journalEntryHeader.count({
      where: { tenantId, status: 'POSTED' },
    });
    if (posted > 0) {
      throw new ConflictException(
        'Base currency cannot be changed after posted accounting journals exist',
      );
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: { baseCurrency: currency },
      select: { id: true, baseCurrency: true },
    });
  }

  async setSettlementAccounts(req: any, gainAccountId: string, lossAccountId: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    if (!gainAccountId || !lossAccountId || gainAccountId === lossAccountId) {
      throw new BadRequestException('Distinct FX gain and loss accounts are required');
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        id: { in: [gainAccountId, lossAccountId] },
        isActive: true,
      },
      select: { id: true, type: true },
    });
    const gain = accounts.find((account) => account.id === gainAccountId);
    const loss = accounts.find((account) => account.id === lossAccountId);
    if (!gain || gain.type !== 'REVENUE') {
      throw new BadRequestException('FX gain account must be an active REVENUE account');
    }
    if (!loss || loss.type !== 'EXPENSE') {
      throw new BadRequestException('FX loss account must be an active EXPENSE account');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: { fxGainAccountId: gainAccountId, fxLossAccountId: lossAccountId },
      select: {
        id: true,
        baseCurrency: true,
        fxGainAccountId: true,
        fxLossAccountId: true,
      },
    });
  }

  async listRates(req: any, query: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const where: any = { tenantId };
    if (query.fromCurrency) where.fromCurrency = this.currency(query.fromCurrency);
    if (query.toCurrency) where.toCurrency = this.currency(query.toCurrency);

    const data = await prisma.exchangeRate.findMany({
      where,
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return { data, count: data.length };
  }

  async createRate(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const fromCurrency = this.currency(dto.fromCurrency);
    const toCurrency = this.currency(dto.toCurrency);
    if (fromCurrency === toCurrency) {
      throw new BadRequestException('Rate currencies must be different');
    }
    const rate = this.rate(dto.rate);
    const effectiveDate = this.date(dto.effectiveDate);
    effectiveDate.setUTCHours(0, 0, 0, 0);

    const existing = await prisma.exchangeRate.findFirst({
      where: { tenantId, fromCurrency, toCurrency, effectiveDate },
      select: { id: true },
    });
    if (existing) {
      return prisma.exchangeRate.update({
        where: { id: existing.id },
        data: { rate, source: dto.source || 'MANUAL' },
      });
    }

    return prisma.exchangeRate.create({
      data: {
        tenantId,
        fromCurrency,
        toCurrency,
        rate,
        effectiveDate,
        source: dto.source || 'MANUAL',
      },
    });
  }

  private async resolveRateInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fromCurrency: string,
    toCurrency: string,
    at: Date,
  ) {
    if (fromCurrency === toCurrency) return new Prisma.Decimal(1);

    const direct = await tx.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency,
        toCurrency,
        effectiveDate: { lte: at },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    if (direct) return new Prisma.Decimal(direct.rate);

    const inverse = await tx.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: toCurrency,
        toCurrency: fromCurrency,
        effectiveDate: { lte: at },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    if (inverse) return new Prisma.Decimal(1).div(inverse.rate);

    throw new BadRequestException(
      `No exchange rate found for ${fromCurrency}/${toCurrency} at journal date`,
    );
  }

  private validateForeignLines(lines: any[]) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new BadRequestException('Foreign-currency journal requires at least two lines');
    }
    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);

    lines.forEach((line, index) => {
      const dr = new Prisma.Decimal(line.foreignDebitAmount ?? 0);
      const cr = new Prisma.Decimal(line.foreignCreditAmount ?? 0);
      if (dr.isNegative() || cr.isNegative()) {
        throw new BadRequestException(`Line ${index + 1}: foreign amounts cannot be negative`);
      }
      if (dr.gt(0) === cr.gt(0)) {
        throw new BadRequestException(
          `Line ${index + 1}: exactly one foreign debit/credit side must be positive`,
        );
      }
      debit = debit.add(dr);
      credit = credit.add(cr);
    });

    if (!debit.equals(credit)) {
      throw new BadRequestException(
        `Foreign journal is not balanced: debit=${debit.toFixed(4)} credit=${credit.toFixed(4)}`,
      );
    }
  }

  private convertLines(lines: any[], rate: Prisma.Decimal) {
    const converted = lines.map((line) => {
      const foreignDebit = new Prisma.Decimal(line.foreignDebitAmount ?? 0);
      const foreignCredit = new Prisma.Decimal(line.foreignCreditAmount ?? 0);
      return {
        accountId: line.accountId,
        debitAmount: foreignDebit.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        creditAmount: foreignCredit.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        foreignDebitAmount: foreignDebit,
        foreignCreditAmount: foreignCredit,
        description: line.description,
        costCenterId: line.costCenterId,
        projectId: line.projectId,
        branchId: line.branchId,
      };
    });

    const debit = converted.reduce(
      (sum, line) => sum.add(line.debitAmount),
      new Prisma.Decimal(0),
    );
    const credit = converted.reduce(
      (sum, line) => sum.add(line.creditAmount),
      new Prisma.Decimal(0),
    );
    const difference = debit.sub(credit);

    if (!difference.isZero()) {
      if (difference.gt(0)) {
        const target = [...converted].reverse().find((line) => line.creditAmount.gt(0));
        if (!target) throw new BadRequestException('Unable to balance converted credit rounding');
        target.creditAmount = target.creditAmount.add(difference);
      } else {
        const target = [...converted].reverse().find((line) => line.debitAmount.gt(0));
        if (!target) throw new BadRequestException('Unable to balance converted debit rounding');
        target.debitAmount = target.debitAmount.add(difference.abs());
      }
    }

    return converted;
  }

  async postForeignJournal(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const transactionCurrency = this.currency(dto.currency);
    const date = this.date(dto.date || new Date());

    return prisma.$transaction(async (tx) => {
      const tenant = await this.tenantConfig(tx, tenantId);
      const baseCurrency = this.currency(tenant.baseCurrency);
      const exchangeRate =
        dto.exchangeRate !== undefined
          ? this.rate(dto.exchangeRate)
          : await this.resolveRateInTransaction(
              tx,
              tenantId,
              transactionCurrency,
              baseCurrency,
              date,
            );

      if (transactionCurrency === baseCurrency && !exchangeRate.equals(1)) {
        throw new BadRequestException('Base-currency journal exchange rate must equal 1');
      }

      this.validateForeignLines(dto.lines);
      const lines = this.convertLines(dto.lines, exchangeRate);

      const journal = await this.posting.postInTransaction(tx, {
        tenantId,
        entryNumber: dto.entryNumber,
        date,
        description: dto.description,
        reference: dto.reference,
        sourceType: dto.sourceType || 'FX_JOURNAL',
        sourceId: dto.sourceId,
        transactionCurrency,
        exchangeRate,
        lines,
      });

      return {
        journal,
        baseCurrency,
        transactionCurrency,
        exchangeRate: Number(exchangeRate),
      };
    });
  }

  async revalue(req: any, dto: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant is required');
    const currency = this.currency(dto.currency);
    const asOfDate = this.date(dto.asOfDate, true);

    return prisma.$transaction(async (tx) => {
      const tenant = await this.tenantConfig(tx, tenantId);
      const baseCurrency = this.currency(tenant.baseCurrency);
      if (currency === baseCurrency) {
        throw new BadRequestException('Base currency does not require FX revaluation');
      }

      const accounts = await tx.chartOfAccount.findMany({
        where: {
          tenantId,
          id: { in: [dto.accountId, dto.gainAccountId, dto.lossAccountId] },
          isActive: true,
        },
        select: { id: true, type: true, code: true, name: true },
      });
      const account = accounts.find((item) => item.id === dto.accountId);
      const gain = accounts.find((item) => item.id === dto.gainAccountId);
      const loss = accounts.find((item) => item.id === dto.lossAccountId);

      if (!account || !['ASSET', 'LIABILITY'].includes(account.type)) {
        throw new BadRequestException(
          'Revaluation account must be an active ASSET or LIABILITY account',
        );
      }
      if (!gain || gain.type !== 'REVENUE') {
        throw new BadRequestException('FX gain account must be an active REVENUE account');
      }
      if (!loss || loss.type !== 'EXPENSE') {
        throw new BadRequestException('FX loss account must be an active EXPENSE account');
      }
      if (new Set([account.id, gain.id, loss.id]).size !== 3) {
        throw new BadRequestException('Revaluation and gain/loss accounts must be distinct');
      }

      const exchangeRate = await this.resolveRateInTransaction(
        tx,
        tenantId,
        currency,
        baseCurrency,
        asOfDate,
      );

      const lines = await tx.journalEntryLine.findMany({
        where: {
          tenantId,
          accountId: account.id,
          journalEntry: {
            tenantId,
            status: 'POSTED',
            transactionCurrency: currency,
            date: { lte: asOfDate },
          },
        },
        select: {
          debitAmount: true,
          creditAmount: true,
          foreignDebitAmount: true,
          foreignCreditAmount: true,
        },
      });

      const creditNormal = account.type === 'LIABILITY';
      let foreignBalance = new Prisma.Decimal(0);
      let carryingBase = new Prisma.Decimal(0);

      for (const line of lines) {
        const foreignDebit = new Prisma.Decimal(line.foreignDebitAmount ?? 0);
        const foreignCredit = new Prisma.Decimal(line.foreignCreditAmount ?? 0);
        const debit = new Prisma.Decimal(line.debitAmount ?? 0);
        const credit = new Prisma.Decimal(line.creditAmount ?? 0);

        foreignBalance = foreignBalance.add(
          creditNormal ? foreignCredit.sub(foreignDebit) : foreignDebit.sub(foreignCredit),
        );
        carryingBase = carryingBase.add(
          creditNormal ? credit.sub(debit) : debit.sub(credit),
        );
      }

      const expectedBase = foreignBalance
        .mul(exchangeRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const difference = expectedBase.sub(carryingBase);

      if (difference.abs().lt(new Prisma.Decimal('0.01'))) {
        return {
          account,
          currency,
          baseCurrency,
          exchangeRate: Number(exchangeRate),
          foreignBalance: Number(foreignBalance),
          carryingBase: Number(carryingBase),
          expectedBase: Number(expectedBase),
          difference: 0,
          journal: null,
        };
      }

      const amount = difference.abs();
      const adjustmentLines: any[] = [];

      if (account.type === 'ASSET') {
        if (difference.gt(0)) {
          adjustmentLines.push(
            { accountId: account.id, debitAmount: amount, description: `FX revaluation ${currency}` },
            { accountId: gain.id, creditAmount: amount, description: `Unrealized FX gain ${currency}` },
          );
        } else {
          adjustmentLines.push(
            { accountId: loss.id, debitAmount: amount, description: `Unrealized FX loss ${currency}` },
            { accountId: account.id, creditAmount: amount, description: `FX revaluation ${currency}` },
          );
        }
      } else if (difference.gt(0)) {
        adjustmentLines.push(
          { accountId: loss.id, debitAmount: amount, description: `Unrealized FX loss ${currency}` },
          { accountId: account.id, creditAmount: amount, description: `FX revaluation ${currency}` },
        );
      } else {
        adjustmentLines.push(
          { accountId: account.id, debitAmount: amount, description: `FX revaluation ${currency}` },
          { accountId: gain.id, creditAmount: amount, description: `Unrealized FX gain ${currency}` },
        );
      }

      const dateKey = asOfDate.toISOString().slice(0, 10);
      const journal = await this.posting.postInTransaction(tx, {
        tenantId,
        entryNumber: dto.entryNumber || `FXR-${currency}-${dateKey}-${account.id.slice(-8)}`,
        date: asOfDate,
        description: `FX revaluation ${currency} to ${baseCurrency} - ${dateKey}`,
        reference: dto.reference || `${account.code}:${currency}`,
        sourceType: 'FX_REVALUATION',
        sourceId: `${account.id}:${currency}:${dateKey}`,
        transactionCurrency: currency,
        exchangeRate,
        lines: adjustmentLines,
      });

      return {
        account,
        currency,
        baseCurrency,
        exchangeRate: Number(exchangeRate),
        foreignBalance: Number(foreignBalance),
        carryingBase: Number(carryingBase),
        expectedBase: Number(expectedBase),
        difference: Number(difference),
        journal,
      };
    });
  }
}
