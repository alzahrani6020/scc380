export type InvoiceType = 'STANDARD' | 'CREDIT_NOTE' | 'PROFORMA' | 'QUOTE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';
export type ZatcaStatus = 'PENDING' | 'REPORTED' | 'CLEARED' | 'REJECTED';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contactId: string;
  type: InvoiceType;
  status: InvoiceStatus;
  subtotal: number;
  taxRate?: number | null;
  taxAmount: number;
  discount?: number | null;
  total: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date | null;
  paidAmount?: number | null;
  zatcaUuid?: string | null;
  zatcaXmlUrl?: string | null;
  zatcaStatus?: ZatcaStatus | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number | null;
  taxRate?: number | null;
  total: number;
  createdAt: Date;
}
