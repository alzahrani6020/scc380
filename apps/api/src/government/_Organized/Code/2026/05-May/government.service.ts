import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';

interface ZatcaInvoice {
  uuid: string;
  invoiceNumber: string;
  issueDate: Date;
  supplierName: string;
  supplierVat: string;
  customerName?: string;
  customerVat?: string;
  total: number;
  vatTotal: number;
  items: { description: string; quantity: number; unitPrice: number; vatRate: number; total: number }[];
}

@Injectable()
export class GovernmentService {
  private zatcaApiKey: string;
  private absherApiKey: string;

  constructor(private config: ConfigService) {
    this.zatcaApiKey = this.config.get('ZATCA_API_KEY') || '';
    this.absherApiKey = this.config.get('ABSHER_API_KEY') || '';
  }

  // ZATCA - Fatoora Phase 2
  async generateZatcaInvoice(tenantId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { items: true },
    });

    if (!invoice) throw new Error('Invoice not found');

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    const zatcaInvoice: ZatcaInvoice = {
      uuid: crypto.randomUUID(),
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      supplierName: tenant?.name || 'Company',
      supplierVat: tenant?.vatNumber || '300000000000003',
      total: Number(invoice.total),
      vatTotal: Number(invoice.taxAmount),
      items: invoice.items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.taxRate || 15),
        total: Number(item.total),
      })),
    };

    // Generate simplified XML (real integration requires ZATCA SDK)
    const xml = this.generateSimplifiedXml(zatcaInvoice);

    // Update invoice with ZATCA UUID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { zatcaUuid: zatcaInvoice.uuid, zatcaStatus: 'REPORTED' },
    });

    return {
      success: true,
      uuid: zatcaInvoice.uuid,
      xml,
      status: 'REPORTED',
      message: 'تم إنشاء الفاتورة الإلكترونية بنجاح (وضع التجربة)',
    };
  }

  private generateSimplifiedXml(invoice: ZatcaInvoice): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
  <cbc:UUID>${invoice.uuid}</cbc:UUID>
  <cbc:IssueDate>${invoice.issueDate.toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${invoice.supplierName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.supplierVat}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="SAR">${invoice.total}</cbc:TaxInclusiveAmount>
  </cac:LegalMonetaryTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${invoice.vatTotal}</cbc:TaxAmount>
  </cac:TaxTotal>
</Invoice>`;
  }

  // Absher - Identity Verification
  async verifyAbsherIdentity(idNumber: string) {
    if (!this.absherApiKey) {
      return {
        success: true,
        verified: true,
        idNumber,
        name: 'أحمد محمد العمري',
        nationality: 'سعودي',
        status: 'نشط',
        message: 'تم التحقق بنجاح (وضع التجربة)',
        mock: true,
      };
    }

    // Real integration would call Absher API
    return { success: false, message: 'API Key not configured' };
  }

  // MOI - Commercial Registration Validation
  async validateCommercialRegistration(crNumber: string) {
    return {
      success: true,
      crNumber,
      companyName: 'شركة التقنية المتقدمة',
      status: 'نشط',
      expiryDate: '2027-12-31',
      message: 'السجل التجاري صالح (وضع التجربة)',
      mock: true,
    };
  }
}
