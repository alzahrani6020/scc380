/**
 * Pure, explainable procurement exception rules for business-owned records.
 * Findings trigger human review, never automatic accusations or employee sanctions.
 */
export type ProcurementTransaction = {
  id: string;
  tenantId: string;
  supplierId: string;
  invoiceNumber: string;
  amountMinorUnits: number;
  currency: string;
  bankAccountFingerprint?: string;
  createdAt: string;
  purchaseOrderId?: string;
  receiptId?: string;
};

export type ProcurementFinding = {
  transactionId: string;
  code: 'DUPLICATE_INVOICE' | 'MISSING_PURCHASE_ORDER' |
    'MISSING_GOODS_RECEIPT' | 'REPEATED_BANK_ACCOUNT';
  relatedTransactionIds: string[];
  requiresHumanReview: true;
};

export function evaluateProcurementExceptions(
  tenantId: string,
  transactions: readonly ProcurementTransaction[],
): ProcurementFinding[] {
  if (!tenantId) throw new Error('Tenant context required');
  // Never compare transactions across tenant boundaries, even if a caller
  // accidentally combines records from different companies.
  const owned = transactions.filter(t =>
    t.tenantId === tenantId && Number.isSafeInteger(t.amountMinorUnits) &&
    t.amountMinorUnits >= 0 && Boolean(t.id && t.supplierId),
  );
  const findings: ProcurementFinding[] = [];
  for (const tx of owned) {
    const duplicate = owned.filter(other =>
      other.id !== tx.id && other.supplierId === tx.supplierId &&
      other.invoiceNumber.trim() !== '' &&
      other.invoiceNumber.trim().toUpperCase() === tx.invoiceNumber.trim().toUpperCase() &&
      other.amountMinorUnits === tx.amountMinorUnits &&
      other.currency === tx.currency,
    );
    if (duplicate.length) findings.push({
      transactionId: tx.id, code: 'DUPLICATE_INVOICE',
      relatedTransactionIds: duplicate.map(t => t.id), requiresHumanReview: true,
    });
    if (!tx.purchaseOrderId) findings.push({
      transactionId: tx.id, code: 'MISSING_PURCHASE_ORDER',
      relatedTransactionIds: [], requiresHumanReview: true,
    });
    if (!tx.receiptId) findings.push({
      transactionId: tx.id, code: 'MISSING_GOODS_RECEIPT',
      relatedTransactionIds: [], requiresHumanReview: true,
    });
    const sharedAccount = tx.bankAccountFingerprint
      ? owned.filter(other => other.id !== tx.id && other.supplierId !== tx.supplierId &&
        other.bankAccountFingerprint === tx.bankAccountFingerprint)
      : [];
    if (sharedAccount.length) findings.push({
      transactionId: tx.id, code: 'REPEATED_BANK_ACCOUNT',
      relatedTransactionIds: sharedAccount.map(t => t.id), requiresHumanReview: true,
    });
  }
  return findings;
}
