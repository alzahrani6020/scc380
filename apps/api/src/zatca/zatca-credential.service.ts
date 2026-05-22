import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@scc/database';
import * as forge from 'node-forge';
import axios from 'axios';

interface ZatcaConfig {
  sandboxBaseUrl: string;
  productionBaseUrl: string;
}

@Injectable()
export class ZatcaCredentialService {
  private config: ZatcaConfig;

  constructor(private envConfig: ConfigService) {
    this.config = {
      sandboxBaseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
      productionBaseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
    };
  }

  // ─── Generate CSR & Keys ─────────────────────────────────────────────
  async generateCSR(tenantId: string, otp: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('المنشأة غير موجودة');
    if (!tenant.vatNumber) {
      throw new BadRequestException('الرقم الضريبي غير مسجل — أضفه أولاً في إعدادات المنشأة');
    }

    // Generate EC key pair (P-256)
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);

    // Create CSR
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keyPair.publicKey;

    // Subject attributes
    const attrs = [
      { shortName: 'CN', value: tenant.vatNumber },
      { shortName: 'O', value: tenant.name },
      { shortName: 'OU', value: 'برنامج محاسبي' },
      { shortName: 'C', value: 'SA' },
    ];
    csr.setSubject(attrs);

    // Sign CSR with private key
    csr.sign(keyPair.privateKey, forge.md.sha256.create());

    const csrPem = forge.pki.certificationRequestToPem(csr);

    // Save to DB
    const credential = await prisma.zatcaCredential.upsert({
      where: { tenantId },
      update: {
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        csrPem,
        otp,
        otpExpiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        status: 'PENDING',
      },
      create: {
        tenantId,
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        csrPem,
        otp,
        otpExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'تم توليد CSR بنجاح',
      csr: csrPem,
      credentialId: credential.id,
    };
  }

  // ─── Request CSID from ZATCA ─────────────────────────────────────────
  async requestCSID(tenantId: string, environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX') {
    const credential = await prisma.zatcaCredential.findUnique({
      where: { tenantId },
    });

    if (!credential) throw new NotFoundException('لم يتم توليد CSR — ابدأ من الخطوة الأولى');
    if (!credential.csrPem) throw new BadRequestException('CSR غير موجود');
    if (!credential.otp) throw new BadRequestException('OTP غير موجود');
    if (credential.otpExpiresAt && credential.otpExpiresAt < new Date()) {
      throw new BadRequestException('انتهت صلاحية OTP — اطلب رمزاً جديداً من بوابة فاتورة');
    }

    const baseUrl = environment === 'PRODUCTION'
      ? this.config.productionBaseUrl
      : this.config.sandboxBaseUrl;

    try {
      // Step 1: Compliance check (for Sandbox)
      const complianceResponse = await axios.post(
        `${baseUrl}/compliance`,
        {
          csr: Buffer.from(credential.csrPem).toString('base64'),
          otp: credential.otp,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      // Step 2: Request Production CSID
      const csidResponse = await axios.post(
        `${baseUrl}/production/csids`,
        {
          csr: Buffer.from(credential.csrPem).toString('base64'),
          otp: credential.otp,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${complianceResponse.data?.token}`,
          },
          timeout: 30000,
        },
      );

      const { binarySecurityToken: csid, secret } = csidResponse.data;

      await prisma.zatcaCredential.update({
        where: { tenantId },
        data: {
          csid,
          secretKey: secret,
          complianceToken: complianceResponse.data?.token,
          status: 'ACTIVE',
          environment,
          lastRenewedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
        },
      });

      return {
        success: true,
        message: `تم الحصول على الشهادة الرقمية (${environment}) بنجاح`,
        status: 'ACTIVE',
      };
    } catch (error: any) {
      const zatcaError = error.response?.data?.message || error.message;
      throw new BadRequestException(`فشل طلب CSID من ZATCA: ${zatcaError}`);
    }
  }

  // ─── Renew CSID ──────────────────────────────────────────────────────
  async renewCSID(tenantId: string) {
    const credential = await prisma.zatcaCredential.findUnique({
      where: { tenantId },
    });

    if (!credential || !credential.csid) {
      throw new BadRequestException('لا توجد شهادة نشطة للتجديد');
    }

    const baseUrl = credential.environment === 'PRODUCTION'
      ? this.config.productionBaseUrl
      : this.config.sandboxBaseUrl;

    try {
      const response = await axios.post(
        `${baseUrl}/production/csids/renew`,
        {},
        {
          headers: {
            Authorization: `Bearer ${credential.complianceToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const { binarySecurityToken: csid, secret } = response.data;

      await prisma.zatcaCredential.update({
        where: { tenantId },
        data: {
          csid,
          secretKey: secret,
          lastRenewedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        },
      });

      return {
        success: true,
        message: 'تم تجديد الشهادة بنجاح',
      };
    } catch (error: any) {
      throw new BadRequestException(`فشل تجديد CSID: ${error.response?.data?.message || error.message}`);
    }
  }

  // ─── Get Credential Status ───────────────────────────────────────────
  async getStatus(tenantId: string) {
    const credential = await prisma.zatcaCredential.findUnique({
      where: { tenantId },
      select: {
        status: true,
        environment: true,
        createdAt: true,
        lastRenewedAt: true,
        expiresAt: true,
        csrPem: true,
        csid: !!true,
      },
    });

    if (!credential) {
      return { status: 'NOT_CONFIGURED', message: 'لم يتم إعداد ZATCA بعد' };
    }

    return {
      status: credential.status,
      environment: credential.environment,
      hasCSR: !!credential.csrPem,
      hasCSID: !!credential.csid,
      createdAt: credential.createdAt,
      lastRenewedAt: credential.lastRenewedAt,
      expiresAt: credential.expiresAt,
    };
  }

  // ─── Get Full Credential (for signing) ───────────────────────────────
  async getCredentialForSigning(tenantId: string) {
    const credential = await prisma.zatcaCredential.findUnique({
      where: { tenantId },
    });

    if (!credential || credential.status !== 'ACTIVE') {
      throw new BadRequestException('الشهادة غير نشطة — أكمل إعداد ZATCA أولاً');
    }

    return {
      privateKey: credential.privateKey,
      csid: credential.csid,
      secretKey: credential.secretKey,
    };
  }
}
