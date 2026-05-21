import { Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ReportsService {
  private async getAccountBalances(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const accounts = await prisma.chartOfAccount.findMany({
      where: tw,
      orderBy: { code: 'asc' },
    });

    const balances = await Promise.all(
      accounts.map(async (acc) => {
        const debits = await prisma.journalEntry.aggregate({
          _sum: { debitAmount: true },
          where: { ...tw, accountId: acc.id },
        });
        const credits = await prisma.journalEntry.aggregate({
          _sum: { creditAmount: true },
          where: { ...tw, accountId: acc.id },
        });

        const totalDebit = Number(debits._sum.debitAmount || 0);
        const totalCredit = Number(credits._sum.creditAmount || 0);

        // For ASSET/EXPENSE: Debit - Credit
        // For LIABILITY/EQUITY/REVENUE: Credit - Debit
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

  // ─── ميزان المراجعة (Trial Balance) ───
  async getTrialBalance(tenantId: string | undefined, userRole: string) {
    const balances = await this.getAccountBalances(tenantId, userRole);

    const totalDebit = balances.reduce((sum, b) => sum + b.debit, 0);
    const totalCredit = balances.reduce((sum, b) => sum + b.credit, 0);

    return {
      accounts: balances,
      totals: { debit: totalDebit, credit: totalCredit },
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  // ─── قائمة الدخل (Income Statement / P&L) ───
  async getIncomeStatement(tenantId: string | undefined, userRole: string) {
    const balances = await this.getAccountBalances(tenantId, userRole);

    const revenueAccounts = balances.filter(b => b.type === 'REVENUE');
    const expenseAccounts = balances.filter(b => b.type === 'EXPENSE');

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenues: {
        items: revenueAccounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalRevenue,
      },
      expenses: {
        items: expenseAccounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
        total: totalExpenses,
      },
      netIncome,
    };
  }

  // ─── الميزانية العمومية (Balance Sheet) ───
  async getBalanceSheet(tenantId: string | undefined, userRole: string) {
    const balances = await this.getAccountBalances(tenantId, userRole);

    const assets = balances.filter(b => b.type === 'ASSET');
    const liabilities = balances.filter(b => b.type === 'LIABILITY');
    const equity = balances.filter(b => b.type === 'EQUITY');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    return {
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

  // ─── الأستاذ العام (General Ledger) ───
  async getGeneralLedger(accountId: string, tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const entries = await prisma.journalEntry.findMany({
      where: { ...tw, accountId },
      orderBy: { createdAt: 'asc' },
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

    return { entries: ledger, finalBalance: runningBalance };
  }

  // ─── VAT Report ───
  async getVatReport(tenantId: string | undefined, userRole: string, from?: string, to?: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { issueDate: dateFilter } : {};

    const [outputVat, inputVat] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { taxAmount: true, total: true },
        where: { ...tw, ...dateWhere },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { ...tw, ...dateWhere },
      }),
    ]);

    const outputVatAmount = Number(outputVat._sum.taxAmount || 0);
    const totalSales = Number(outputVat._sum.total || 0);
    const inputVatAmount = Number(inputVat._sum.amount || 0) * 0.15;
    const netVat = outputVatAmount - inputVatAmount;

    return {
      period: { from: from || 'all', to: to || 'all' },
      outputVat: { totalSales, vatAmount: outputVatAmount },
      inputVat: { totalExpenses: Number(inputVat._sum.amount || 0), vatAmount: inputVatAmount },
      netVatPayable: netVat > 0 ? netVat : 0,
      netVatReceivable: netVat < 0 ? Math.abs(netVat) : 0,
    };
  }

  // ─── Cash Flow Statement ───
  async getCashFlow(tenantId: string | undefined, userRole: string) {
    const tw = userRole === 'SUPER_ADMIN' ? {} : tenantWhere(tenantId);

    // Find cash account (code 1110)
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
      where: { ...tw, accountId: cashAccount.id },
      orderBy: { date: 'asc' },
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
    });

    // Categorize based on the OTHER account in the transaction
    // For simplicity, categorize by reference patterns and account types
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

      if (entry.reference?.startsWith('INV-') || entry.reference?.startsWith('PO-') || entry.reference?.startsWith('RENT-') || entry.reference?.startsWith('PAY-') || entry.reference?.startsWith('MKT-') || entry.reference?.startsWith('UTIL-') || entry.reference?.startsWith('MNT-')) {
        operatingItems.push(item);
      } else if (entry.reference?.startsWith('EQUIP-') || entry.reference?.startsWith('ASSET-')) {
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

    // Calculate opening balance (before first entry)
    let openingBalance = 0;
    if (entries.length > 0) {
      const firstEntry = entries[0];
      const entriesBefore = await prisma.journalEntry.findMany({
        where: {
          ...tw,
          accountId: cashAccount.id,
          date: { lt: firstEntry.date },
        },
      });
      openingBalance = entriesBefore.reduce((s, e) => s + Number(e.debitAmount) - Number(e.creditAmount), 0);
    }

    return {
      operating: { items: operatingItems, total: totalOperating },
      investing: { items: investingItems, total: totalInvesting },
      financing: { items: financingItems, total: totalFinancing },
      netChange,
      openingBalance,
      closingBalance: openingBalance + netChange,
    };
  }
}
