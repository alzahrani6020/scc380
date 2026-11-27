import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProcurementExceptions, type ProcurementTransaction } from '../src/field-devices/procurement-risk.rules';

const base: ProcurementTransaction = {
  id: 'inv-1', tenantId: 'company-a', supplierId: 'supplier-1',
  invoiceNumber: 'INV-100', amountMinorUnits: 120000, currency: 'SAR',
  bankAccountFingerprint: 'fingerprint-a', createdAt: '2026-11-27T12:00:00Z',
  purchaseOrderId: 'po-1', receiptId: 'receipt-1',
};

test('matches only company-owned records even with a mixed input batch', () => {
  const findings = evaluateProcurementExceptions('company-a', [
    base, { ...base, id: 'other-company', tenantId: 'company-b' },
  ]);
  assert.deepEqual(findings, []);
});

test('flags duplicate company invoices for manual review', () => {
  const findings = evaluateProcurementExceptions('company-a', [
    base, { ...base, id: 'inv-2', invoiceNumber: ' inv-100 ' },
  ]);
  assert.equal(findings.filter(f => f.code === 'DUPLICATE_INVOICE').length, 2);
  assert.ok(findings.every(f => f.requiresHumanReview));
});

test('flags missing purchase order and goods receipt without automatic sanctions', () => {
  const findings = evaluateProcurementExceptions('company-a', [
    { ...base, purchaseOrderId: undefined, receiptId: undefined },
  ]);
  assert.deepEqual(findings.map(f => f.code), ['MISSING_PURCHASE_ORDER', 'MISSING_GOODS_RECEIPT']);
});

test('shared supplier bank fingerprint merits review only when suppliers differ', () => {
  const findings = evaluateProcurementExceptions('company-a', [
    base, { ...base, id: 'inv-2', supplierId: 'supplier-2', invoiceNumber: 'INV-101' },
  ]);
  assert.equal(findings.filter(f => f.code === 'REPEATED_BANK_ACCOUNT').length, 2);
});

test('rejects missing tenant and ignores invalid financial amounts', () => {
  assert.throws(() => evaluateProcurementExceptions('', [base]));
  assert.deepEqual(evaluateProcurementExceptions('company-a', [
    { ...base, amountMinorUnits: Number.NaN },
  ]), []);
});
