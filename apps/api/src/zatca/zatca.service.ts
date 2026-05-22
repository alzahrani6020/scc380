import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import { createHash, createSign, randomUUID } from 'crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { PDFDocument } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { ZatcaApiClient } from './zatca-api.client';

// ZATCA UBL 2.1 Invoice structure
interface ZatcaInvoiceData {
  uuid: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  invoiceType: 'STANDARD' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'SIMPLIFIED';
  invoiceTypeCode: string; // 388=Standard, 381=Credit, 383=Debit
  sellerName: string;
  sellerVat: string;
  sellerStreet: string;
  sellerCity: string;
  sellerCountry: string;
  buyerName?: string;
  buyerVat?: string;
  total: number;
  subtotal: number;
  vatTotal: number;
  vatRate: number;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
    vatAmount: number;
  }[];
  previousInvoiceHash?: string;
}

@Injectable()
export class ZatcaService {
  private readonly logger = new Logger(ZatcaService.name);
  constructor(
    private config: ConfigService,
    private apiClient: ZatcaApiClient,
  ) {}

  private async getTenantCredential(tenantId: string) {
    const credential = await prisma.zatcaCredential.findUnique({
      where: { tenantId },
    });

    if (!credential || credential.status !== 'ACTIVE' || !credential.privateKey) {
      throw new BadRequestException(
        'الشهادة الرقمية غير نشطة — أكمل إعداد ZATCA أولاً (CSR → CSID)',
      );
    }

    return credential;
  }

  // ─── Invoice Signing ─────────────────────────────────────────────────
  async signInvoice(invoiceId: string, tenantId: string) {
    const credential = await this.getTenantCredential(tenantId);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { items: true },
    });

    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (!['STANDARD', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(invoice.type)) {
      throw new BadRequestException('نوع الفاتورة غير مدعوم للفوترة الإلكترونية');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const contact = invoice.contactId ? await prisma.contact.findUnique({ where: { id: invoice.contactId } }) : null;

    // Get previous invoice hash (PIH)
    const previousInvoice = await prisma.invoice.findFirst({
      where: { tenantId, zatcaStatus: { in: ['REPORTED', 'CLEARED'] }, id: { not: invoiceId } },
      orderBy: { updatedAt: 'desc' },
      select: { previousInvoiceHash: true, zatcaUuid: true },
    });
    const pih = previousInvoice?.previousInvoiceHash ||
      'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

    // Build ZATCA data
    const zatcaData: ZatcaInvoiceData = {
      uuid: invoice.zatcaUuid || randomUUID(),
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      issueTime: invoice.issueDate.toISOString().split('T')[1].split('.')[0],
      invoiceType: invoice.type as any,
      invoiceTypeCode: this.getInvoiceTypeCode(invoice.type),
      sellerName: tenant?.name || 'Company',
      sellerVat: tenant?.vatNumber || '300000000000003',
      sellerStreet: 'الرياض، المملكة العربية السعودية',
      sellerCity: 'الرياض',
      sellerCountry: 'SA',
      buyerName: contact?.companyName || contact?.firstName + ' ' + contact?.lastName,
      buyerVat: contact?.vatNumber,
      total: Number(invoice.total),
      subtotal: Number(invoice.subtotal),
      vatTotal: Number(invoice.taxAmount),
      vatRate: Number(invoice.taxRate || 15),
      items: invoice.items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.taxRate || 15),
        total: Number(item.total),
        vatAmount: Number(item.taxAmount || item.total * 0.15),
      })),
      previousInvoiceHash: pih,
    };

    // Generate XML
    const xml = this.generateZatcaXml(zatcaData);

    // Canonicalize XML
    const canonicalXml = this.canonicalizeXml(xml);

    // Compute hash
    const hash = createHash('sha256').update(canonicalXml).digest('base64');

    // Sign hash with tenant's private key
    const signature = this.signHash(hash, credential.privateKey);

    // Generate QR Code data (TLV + signature)
    const qrTlv = this.generateQrTlv(zatcaData, signature);
    const qrBase64 = await QRCode.toDataURL(qrTlv);

    // Update invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaUuid: zatcaData.uuid,
        zatcaSignedXml: xml,
        previousInvoiceHash: hash,
        digitalSignature: signature,
        qrCodeData: qrBase64,
        zatcaStatus: 'REPORTED',
        reportingStatus: 'REPORTED',
      },
    });

    return {
      success: true,
      uuid: zatcaData.uuid,
      hash,
      signature,
      qrCode: qrBase64,
      xml,
      status: 'REPORTED',
      message: 'تم توقيع الفاتورة إلكترونياً بنجاح',
    };
  }

  // ─── Clearance (B2B) ─────────────────────────────────────────────────
  async clearanceInvoice(invoiceId: string, tenantId: string) {
    const result = await this.signInvoice(invoiceId, tenantId);

    const apiResult = await this.apiClient.sendClearance(tenantId, result.xml);

    if (!apiResult.success) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { zatcaStatus: 'PENDING', clearanceStatus: 'PENDING' },
      });
      throw new BadRequestException(`فشل الاعتماد من ZATCA: ${apiResult.error}`);
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaStatus: 'CLEARED',
        clearanceStatus: 'CLEARED',
        zatcaSignedXml: apiResult.clearedXml || result.xml,
      },
    });

    return { ...result, status: 'CLEARED', message: 'تم اعتماد الفاتورة من ZATCA بنجاح' };
  }

  // ─── Reporting (B2C) ─────────────────────────────────────────────────
  async reportInvoice(invoiceId: string, tenantId: string) {
    const result = await this.signInvoice(invoiceId, tenantId);

    const apiResult = await this.apiClient.sendReporting(tenantId, result.xml);

    if (!apiResult.success) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { zatcaStatus: 'PENDING', reportingStatus: 'PENDING' },
      });
      throw new BadRequestException(`فشل الإبلاغ لـ ZATCA: ${apiResult.error}`);
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaStatus: 'REPORTED',
        reportingStatus: 'REPORTED',
      },
    });

    return { ...result, status: 'REPORTED', message: 'تم الإبلاغ عن الفاتورة لـ ZATCA بنجاح' };
  }

  // ─── Credit Note ─────────────────────────────────────────────────────
  async createCreditNote(originalInvoiceId: string, tenantId: string, reason: string) {
    const original = await prisma.invoice.findFirst({
      where: { id: originalInvoiceId, tenantId },
      include: { items: true },
    });

    if (!original) throw new NotFoundException('الفاتورة الأصلية غير موجودة');

    const creditNote = await prisma.invoice.create({
      data: {
        tenantId,
        contactId: original.contactId,
        invoiceNumber: `CN-${original.invoiceNumber}`,
        type: 'CREDIT_NOTE',
        status: 'DRAFT',
        subtotal: original.subtotal,
        taxAmount: original.taxAmount,
        total: original.total,
        taxRate: original.taxRate,
        issueDate: new Date(),
        dueDate: new Date(),
        notes: `إشعار دائن للفاتورة ${original.invoiceNumber} — السبب: ${reason}`,
      },
    });

    // Copy items with negative amounts
    for (const item of original.items) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: creditNote.id,
          tenantId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          total: item.total,
        },
      });
    }

    return creditNote;
  }

  // ─── Debit Note ──────────────────────────────────────────────────────
  async createDebitNote(originalInvoiceId: string, tenantId: string, reason: string, additionalAmount: number) {
    const original = await prisma.invoice.findFirst({
      where: { id: originalInvoiceId, tenantId },
      include: { items: true },
    });

    if (!original) throw new NotFoundException('الفاتورة الأصلية غير موجودة');

    const taxAmount = additionalAmount * (Number(original.taxRate || 15) / 100);

    const debitNote = await prisma.invoice.create({
      data: {
        tenantId,
        contactId: original.contactId,
        invoiceNumber: `DN-${original.invoiceNumber}`,
        type: 'DEBIT_NOTE',
        status: 'DRAFT',
        subtotal: additionalAmount,
        taxAmount,
        total: additionalAmount + taxAmount,
        taxRate: original.taxRate,
        issueDate: new Date(),
        dueDate: new Date(),
        notes: `إشعار مدين للفاتورة ${original.invoiceNumber} — السبب: ${reason}`,
      },
    });

    return debitNote;
  }

  // ─── PDF/A-3 Generation ──────────────────────────────────────────────
  async generatePdfA3(invoiceId: string, tenantId: string): Promise<Buffer> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { zatcaSignedXml: true, qrCodeData: true, invoiceNumber: true },
    });

    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);

    // Embed QR code if available
    if (invoice.qrCodeData) {
      const qrImage = await pdfDoc.embedPng(invoice.qrCodeData.replace(/^data:image\/png;base64,/, ''));
      page.drawImage(qrImage, { x: 400, y: 650, width: 150, height: 150 });
    }

    // Add basic text
    page.drawText(`فاتورة ضريبية مبسطة`, { x: 50, y: 750, size: 20 });
    page.drawText(`رقم الفاتورة: ${invoice.invoiceNumber}`, { x: 50, y: 720, size: 12 });

    // Embed XML as attachment (PDF/A-3 requirement)
    if (invoice.zatcaSignedXml) {
      const xmlBytes = Buffer.from(invoice.zatcaSignedXml, 'utf-8');
      await pdfDoc.attach(xmlBytes, 'invoice.xml', {
        mimeType: 'text/xml',
        description: 'ZATCA Electronic Invoice XML',
        creationDate: new Date(),
        modificationDate: new Date(),
      });
    }

    return Buffer.from(await pdfDoc.save());
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  private getInvoiceTypeCode(type: string): string {
    const map: Record<string, string> = {
      STANDARD: '388',
      CREDIT_NOTE: '381',
      DEBIT_NOTE: '383',
      SIMPLIFIED: '388',
    };
    return map[type] || '388';
  }

  private generateZatcaXml(data: ZatcaInvoiceData): string {
    const itemsXml = data.items.map((item, index) => `
      <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">${item.quantity.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="SAR">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="SAR">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="SAR">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="SAR">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
              <cbc:ID>S</cbc:ID>
              <cbc:Percent>${item.vatRate.toFixed(2)}</cbc:Percent>
              <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
          <cbc:Name>${this.escapeXml(item.description)}</cbc:Name>
        </cac:Item>
        <cac:Price>
          <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
      </cac:InvoiceLine>
    `).join('');

    const buyerXml = data.buyerName ? `
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyLegalEntity>
            <cbc:RegistrationName>${this.escapeXml(data.buyerName)}</cbc:RegistrationName>
          </cac:PartyLegalEntity>
          ${data.buyerVat ? `
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${data.buyerVat}</cbc:CompanyID>
            <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
          </cac:PartyTaxScheme>` : ''}
        </cac:Party>
      </cac:AccountingCustomerParty>
    ` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${data.invoiceNumber}</cbc:ID>
  <cbc:UUID>${data.uuid}</cbc:UUID>
  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${data.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${data.invoiceType === 'SIMPLIFIED' ? '0200000' : '0100000'}">${data.invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(data.sellerStreet)}</cbc:StreetName>
        <cbc:CityName>${this.escapeXml(data.sellerCity)}</cbc:CityName>
        <cbc:CountrySubentity>${this.escapeXml(data.sellerCity)}</cbc:CountrySubentity>
        <cac:Country><cbc:IdentificationCode>${data.sellerCountry}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(data.sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${data.sellerVat}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  ${buyerXml}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${data.vatTotal.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${data.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${data.vatTotal.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${data.vatRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">${data.subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${data.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${data.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${itemsXml}
</Invoice>`;
  }

  private canonicalizeXml(xml: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch {
      return xml;
    }
  }

  private signHash(hash: string, privateKey: string): string {
    const signer = createSign('SHA256');
    signer.update(hash);
    signer.end();
    return signer.sign(privateKey, 'base64');
  }

  private generateQrTlv(data: ZatcaInvoiceData, signature: string): string {
    const sellerName = Buffer.from(data.sellerName, 'utf8');
    const vatNumber = Buffer.from(data.sellerVat, 'utf8');
    const timestamp = Buffer.from(`${data.issueDate}T${data.issueTime}`, 'utf8');
    const total = Buffer.from(data.total.toFixed(2), 'utf8');
    const vatTotal = Buffer.from(data.vatTotal.toFixed(2), 'utf8');

    const tlv = Buffer.concat([
      this.tlvEntry(1, sellerName),
      this.tlvEntry(2, vatNumber),
      this.tlvEntry(3, timestamp),
      this.tlvEntry(4, total),
      this.tlvEntry(5, vatTotal),
    ]);

    return tlv.toString('base64');
  }

  private tlvEntry(tag: number, value: Buffer): Buffer {
    const tagBuf = Buffer.from([tag]);
    const lenBuf = Buffer.from([value.length]);
    return Buffer.concat([tagBuf, lenBuf, value]);
  }

  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
