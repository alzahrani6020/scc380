import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

type UnifiedLedgerRow = {
  id: string;
  date: Date;
  createdAt: Date;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
};

@Injectable()
export class ReportsService {
  private buildDateFilter(from?: string, to?: string) {
    const date: any = {};
    if (from) date.gte = new Date(from);
    if (to) date.lte = new Date(to);
    return Object.keys(date).length ? date : undefined;
  }

  private tenantFilter(tenantId: string | undefined, userRole: string) {
    return userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
  }

  private legacyPostedWhere(
    tenantId: string | undefined,
    userRole: string,
    from?: string,
    to?: string,
  ) {
    const date = this.buildDateFilter(from, to);
    return {
      ...this.tenantFilter(tenantId, userRole),
      status: 'POSTED',
      NOT: { entryNumber: { startsWith: 'LEG-' } },
      ...(date ? { date } : {}),
    } as any;
  }

  private modernHeaderWhere(from?: string, to?: string) {
    const date = this.buildDateFilter(from, to);
    return {
      status: 'POSTED',
      ...(date ? { date } : {}),
    } as any;
  }

  private async getAccountBalances(
    tenantId: string | undefined,
    userRole: string,
    from?: string,
    to?: string,
  ) {
    const tenant = this.tenantFilter(tenantId, userRole);
    const [accounts, legacyBalances, modernBalances] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where: tenant,
        orderBy: { code: 'asc' },
      }),
      prisma.journalEntry.groupBy({
        by: ['accountId'],
        where: this.legacyPostedWhere(tenantId, userRole, from, to),
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          ...tenant,
          journalEntry: this.modernHeaderWhere(from, to),
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const totals = new Map<string, { debit: number; credit: number }>();
    const add = (accountId: string | null, debit: unknown, credit: unknown) => {
      if (!accountId) return;
      const current = totals.get(accountId) || { debit: 0, credit: 0 };
      current.debit += Number(debit || 0);
      current.credit += Number(credit || 0);
      totals.set(accountId, current);
    };

    for (const row of legacyBalances) {
      add(row.accountId, row._sum.debitAmount, row._sum.creditAmount);
    }
    for (const row of modernBalances) {
      add(row.accountId, row._sum.debitAmount, row._sum.creditAmount);
    }

    return accounts.map((acc) => {
      const amount = totals.get(acc.id) || { debit: 0, credit: 0 };
      const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
      const netBalance = isDebitNormal
        ? amount.debit - amount.credit
        : amount.credit - amount.debit;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: amount.debit,
        credit: amount.credit,
        balance: netBalance,
        isDebit: netBalance >= 0,
      };
    });
  }

  private async getUnifiedLedgerRows(
    accountId: string,
    tenantId: string | undefined,
    userRole: string,
    from?: string,
    to?: string,
  ): Promise<UnifiedLedgerRow[]> {
    const tenant = this.tenantFilter(tenantId, userRole);
    const [legacy, modern] = await Promise.all([
      prisma.journalEntry.findMany({
        where: {
          ...this.legacyPostedWhere(tenantId, userRole, from, to),
          accountId,
        },
        select: {
          id: true,
          date: true,
          createdAt: true,
          description: true,
          reference: true,
          debitAmount: true,
          creditAmount: true,
        },
      }),
      prisma.journalEntryLine.findMany({
        where: {
          ...tenant,
          accountId,
          journalEntry: this.modernHeaderWhere(from, to),
        },
        include: {
          journalEntry: {
            select: {
              date: true,
              createdAt: true,
              description: true,
              reference: true,
            },
          },
        },
      }),
    ]);

    const rows: UnifiedLedgerRow[] = [
      ...legacy.map((entry) => ({
        id: `legacy:${entry.id}`,
        date: entry.date,
        createdAt: entry.createdAt,
        description: entry.description,
        reference: entry.reference,
        debit: Number(entry.debitAmount),
        credit: Number(entry.creditAmount),
      })),
      ...modern.map((line) => ({
        id: `line:${line.id}`,
        date: line.journalEntry.date,
        createdAt: line.createdAt,
        description: line.description || line.journalEntry.description,
        reference: line.journalEntry.reference,
        debit: Number(line.debitAmount),
        credit: Number(line.creditAmount),
      })),
    ];

    return rows.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;
      return a.id.localeCompare(b.id);
    });
  }

  async getTrialBalance(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const balances = await this.getAccountBalances(tenantId, userRole, from, to);
    const totalDebit = balances.reduce((sum, b) => sum + b.debit, 0);
    const totalCredit = balances.reduce((sum, b) => sum + b.credit, 0);

    return {
      period: { from: from || 'all', to: to || 'all' },
      accounts: balances,
      totals: { debit: totalDebit, credit: totalCredit },
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  async getIncomeStatement(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const balances = await this.getAccountBalances(tenantId, userRole, from, to);
    const revenueAccounts = balances.filter(b => b.type === 'REVENUE');
    const expenseAccounts = balances.filter(b => b.type === 'EXPENSE');

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);

    return {
      period: { from: from || 'all', to: to || 'all' },
      revenues: {
        items: revenueAccounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalRevenue,
      },
      expenses: {
        items: expenseAccounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalExpenses,
      },
      netIncome: totalRevenue - totalExpenses,
    };
  }

  async getBalanceSheet(tenantId: string | undefined, userRole: string, asOfDate?: string) {
    const balances = await this.getAccountBalances(tenantId, userRole, undefined, asOfDate);
    const assets = balances.filter(b => b.type === 'ASSET');
    const liabilities = balances.filter(b => b.type === 'LIABILITY');
    const equity = balances.filter(b => b.type === 'EQUITY');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    return {
      asOfDate: asOfDate || 'all',
      assets: {
        items: assets.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalAssets,
      },
      liabilities: {
        items: liabilities.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalLiabilities,
      },
      equity: {
        items: equity.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  async getGeneralLedger(
    accountId: string,
    tenantId: string | undefined,
    userRole: string,
    from?: string,
    to?: string,
  ) {
    const rows = await this.getUnifiedLedgerRows(accountId, tenantId, userRole, from, to);

    let runningBalance = 0;
    const entries = rows.map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return {
        id: entry.id,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        debit: entry.debit,
        credit: entry.credit,
        balance: runningBalance,
      };
    });

    return {
      period: { from: from || 'all', to: to || 'all' },
      entries,
      finalBalance: runningBalance,
    };
  }

  async getVatReport(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const tw = this.tenantFilter(tenantId, userRole);
    const date = this.buildDateFilter(from, to);

    const [outputVat, inputVat] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { taxAmount: true, total: true },
        where: {
          ...tw,
          status: { in: ['SENT', 'VIEWED', 'PAID', 'PARTIAL', 'OVERDUE'] },
          ...(date ? { issueDate: date } : {}),
        },
      }),
      prisma.supplierInvoice.aggregate({
        _sum: { taxAmount: true, total: true },
        where: {
          ...tw,
          status: { not: 'CANCELLED' },
          ...(date ? { issueDate: date } : {}),
        },
      }),
    ]);

    const outputVatAmount = Number(outputVat._sum.taxAmount || 0);
    const inputVatAmount = Number(inputVat._sum.taxAmount || 0);
    const netVat = outputVatAmount - inputVatAmount;

    return {
      period: { from: from || 'all', to: to || 'all' },
      outputVat: {
        totalSales: Number(outputVat._sum.total || 0),
        vatAmount: outputVatAmount,
      },
      inputVat: {
        totalPurchases: Number(inputVat._sum.total || 0),
        vatAmount: inputVatAmount,
      },
      netVatPayable: netVat > 0 ? netVat : 0,
      netVatReceivable: netVat < 0 ? Math.abs(netVat) : 0,
    };
  }

  async getCashFlow(tenantId: string | undefined, userRole: string) {
    const tw = this.tenantFilter(tenantId, userRole);
    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: { ...tw, code: '1110' },
    });

    if (!cashAccount) {
      return {
        operating: { items: [], total: 0 },
        investing: { items: [], total: 0 },
        financing: { items: [], total: 0 },
        netChange: 0,
        openingBalance: 0,
        closingBalance: 0,
      };
    }

    const entries = await this.getUnifiedLedgerRows(
      cashAccount.id,
      tenantId,
      userRole,
    );

    const operatingItems: any[] = [];
    const investingItems: any[] = [];
    const financingItems: any[] = [];

    for (const entry of entries) {
      const amount = entry.debit - entry.credit;
      const item = {
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        amount,
      };

      if (entry.reference?.startsWith('EQUIP-') || entry.reference?.startsWith('ASSET-')) {
        investingItems.push(item);
      } else if (
        entry.reference?.startsWith('LOAN-') ||
        entry.reference?.startsWith('CAP-') ||
        entry.reference?.startsWith('OP-')
      ) {
        financingItems.push(item);
      } else {
        operatingItems.push(item);
      }
    }

    const totalOperating = operatingItems.reduce((s, i) => s + i.amount, 0);
    const totalInvesting = investingItems.reduce((s, i) => s + i.amount, 0);
    const totalFinancing = financingItems.reduce((s, i) => s + i.amount, 0);
    const netChange = totalOperating + totalInvesting + totalFinancing;

    return {
      operating: { items: operatingItems, total: totalOperating },
      investing: { items: investingItems, total: totalInvesting },
      financing: { items: financingItems, total: totalFinancing },
      netChange,
      openingBalance: 0,
      closingBalance: netChange,
    };
  }
}
