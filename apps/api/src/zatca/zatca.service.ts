import { Injectable } from '@nestjs/common';

@Injectable()
export class ZatcaService {
  private sellerName = 'Smart Command Center (SCC)';
  private vatNumber = '300000000000003'; // Demo VAT number

  generateTlv(invoice: any): string {
    const sellerNameBytes = Buffer.from(this.sellerName, 'utf8');
    const vatNumberBytes = Buffer.from(this.vatNumber, 'utf8');
    const timestampBytes = Buffer.from(new Date(invoice.issueDate).toISOString(), 'utf8');
    const totalBytes = Buffer.from(Number(invoice.total).toFixed(2), 'utf8');
    const vatTotalBytes = Buffer.from(Number(invoice.taxAmount).toFixed(2), 'utf8');

    const tlv = Buffer.concat([
      this.tlvEntry(1, sellerNameBytes),
      this.tlvEntry(2, vatNumberBytes),
      this.tlvEntry(3, timestampBytes),
      this.tlvEntry(4, totalBytes),
      this.tlvEntry(5, vatTotalBytes),
    ]);

    return tlv.toString('base64');
  }

  private tlvEntry(tag: number, value: Buffer): Buffer {
    const tagBuf = Buffer.from([tag]);
    const lenBuf = Buffer.from([value.length]);
    return Buffer.concat([tagBuf, lenBuf, value]);
  }

  generateXml(invoice: any): string {
    const items = invoice.items || [];
    const itemsXml = items.map((item: any, index: number) => `
      <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="SAR">${(item.quantity * item.unitPrice * 0.15).toFixed(2)}</cbc:TaxAmount>
          <cbc:RoundingAmount currencyID="SAR">${(item.quantity * item.unitPrice * 1.15).toFixed(2)}</cbc:RoundingAmount>
          <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${(item.quantity * item.unitPrice * 0.15).toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
              <cbc:ID>S</cbc:ID>
              <cbc:Percent>15</cbc:Percent>
              <cac:TaxScheme>
                <cbc:ID>VAT</cbc:ID>
              </cac:TaxScheme>
            </cac:TaxCategory>
          </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
          <cbc:Name>${item.description}</cbc:Name>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
          <cbc:BaseQuantity unitCode="PCE">1</cbc:BaseQuantity>
        </cac:Price>
      </cac:InvoiceLine>
    `).join('');

    const uuid = invoice.zatcaUuid || this.generateUuid();
    const issueDate = new Date(invoice.issueDate).toISOString().split('T')[0];
    const issueTime = new Date(invoice.issueDate).toISOString().split('T')[1].split('.')[0];

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.sellerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${this.vatNumber}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${Number(invoice.taxAmount).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${Number(invoice.subtotal).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${Number(invoice.taxAmount).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxInclusiveAmount currencyID="SAR">${Number(invoice.total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${Number(invoice.total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${itemsXml}
</Invoice>`;
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
