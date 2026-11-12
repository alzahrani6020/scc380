import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ReportsService {
  private buildDateFilter(from?: string, to?: string) {
    const date: any = {};
    if (from) date.gte = new Date(from);
    if (to) date.lte = new Date(to);
    return Object.keys(date).length ? date : undefined;
  }

  private async getAccountBalances(
    tenantId: string | undefined,
    userRole: string,
    from?: string,
    to?: string,
  ) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const date = this.buildDateFilter(from, to);
    const accounts = await prisma.chartOfAccount.findMany({
      where: tw,
      orderBy: { code: 'asc' },
    });

    const balances = await Promise.all(
      accounts.map(async (acc) => {
        const baseWhere: any = {
          ...tw,
          accountId: acc.id,
          status: 'POSTED',
          ...(date ? { date } : {}),
        };
        const [debits, credits] = await Promise.all([
          prisma.journalEntry.aggregate({
            _sum: { debitAmount: true },
            where: baseWhere,
          }),
          prisma.journalEntry.aggregate({
            _sum: { creditAmount: true },
            where: baseWhere,
          }),
        ]);

        const totalDebit = Number(debits._sum.debitAmount || 0);
        const totalCredit = Number(credits._sum.creditAmount || 0);
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
        const netBalance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit: totalDebit,
          credit: totalCredit,
          balance: netBalance,
          isDebit: netBalance >= 0,
        };
      }),
    );

    return balances;
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
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const date = this.buildDateFilter(from, to);
    const entries = await prisma.journalEntry.findMany({
      where: {
        ...tw,
        accountId,
        status: 'POSTED',
        ...(date ? { date } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    let runningBalance = 0;
    const ledger = entries.map(entry => {
      runningBalance += Number(entry.debitAmount) - Number(entry.creditAmount);
      return {
        id: entry.id,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        debit: Number(entry.debitAmount),
        credit: Number(entry.creditAmount),
        balance: runningBalance,
      };
    });

    return {
      period: { from: from || 'all', to: to || 'all' },
      entries: ledger,
      finalBalance: runningBalance,
    };
  }

  async getVatReport(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const date = this.buildDateFilter(from, to);

    const [outputVat, inputVat] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { taxAmount: true, total: true },
        where: {
          ...tw,
          status: { not: 'DRAFT' },
          ...(date ? { issueDate: date } : {}),
        },
      }),
      prisma.supplierInvoice.aggregate({
        _sum: { taxAmount: true, total: true },
        where: {
          ...tw,
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
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
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

    const entries = await prisma.journalEntry.findMany({
      where: { ...tw, accountId: cashAccount.id, status: 'POSTED' },
      orderBy: { date: 'asc' },
      include: {
        chartAccount: { select: { code: true, name: true, type: true } },
      },
    });

    const operatingItems: any[] = [];
    const investingItems: any[] = [];
    const financingItems: any[] = [];

    for (const entry of entries) {
      const amount = Number(entry.debitAmount) - Number(entry.creditAmount);
      const item = {
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        amount,
      };

      if (entry.reference?.startsWith('EQUIP-') || entry.reference?.startsWith('ASSET-')) {
        investingItems.push(item);
      } else if (entry.reference?.startsWith('LOAN-') || entry.reference?.startsWith('CAP-') || entry.reference?.startsWith('OP-')) {
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
