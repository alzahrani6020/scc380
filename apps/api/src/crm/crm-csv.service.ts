import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

const MAX_CSV_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;
const ALLOWED_TYPES = new Set(['CUSTOMER', 'LEAD', 'PROSPECT', 'PARTNER', 'SUPPLIER', 'VENDOR']);
const ALLOWED_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'CONVERTED', 'BLACKLISTED']);

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (quoted) throw new BadRequestException('Malformed CSV: unclosed quote');
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v !== ''));
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

@Injectable()
export class CrmCsvService {
  private tenantIdFor(req: any) {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  async exportContacts(req: any) {
    const tenantId = this.tenantIdFor(req);
    const contacts = await prisma.contact.findMany({
      where: tenantWhere(tenantId),
      orderBy: { createdAt: 'asc' },
      take: 5000,
      select: {
        firstName: true, lastName: true, email: true, phone: true, phone2: true,
        companyName: true, jobTitle: true, city: true, region: true, country: true,
        type: true, status: true,
      },
    });
    const headers = ['firstName','lastName','email','phone','phone2','companyName','jobTitle','city','region','country','type','status'];
    const lines = [headers.join(',')];
    for (const contact of contacts) {
      lines.push(headers.map((h) => csvCell((contact as any)[h])).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  async importContacts(req: any, csv: string, dryRun = true) {
    if (typeof csv !== 'string' || !csv.trim()) throw new BadRequestException('CSV content is required');
    if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) throw new BadRequestException('CSV exceeds 1 MB limit');

    const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
    if (rows.length < 2) throw new BadRequestException('CSV must contain a header and at least one data row');
    if (rows.length - 1 > MAX_ROWS) throw new BadRequestException('CSV exceeds 1000 data rows');

    const headers = rows[0].map((h) => h.trim());
    const required = ['firstName', 'lastName'];
    for (const name of required) {
      if (!headers.includes(name)) throw new BadRequestException(`Missing required column: ${name}`);
    }

    const allowed = new Set(['firstName','lastName','email','phone','phone2','companyName','jobTitle','city','region','country','type','status']);
    const unknown = headers.filter((h) => !allowed.has(h));
    if (unknown.length) throw new BadRequestException(`Unsupported columns: ${unknown.join(', ')}`);

    const tenantId = this.tenantIdFor(req);
    const scope = tenantWhere(tenantId);
    const parsed = rows.slice(1).map((values, index) => {
      const item: any = {};
      headers.forEach((h, i) => { if (values[i] !== undefined && values[i] !== '') item[h] = values[i]; });
      return { row: index + 2, item };
    });

    const errors: Array<{ row: number; message: string }> = [];
    const seenEmails = new Set<string>();
    const emailCandidates: string[] = [];

    for (const entry of parsed) {
      const x = entry.item;
      if (!x.firstName || !x.lastName) errors.push({ row: entry.row, message: 'firstName and lastName are required' });
      if (x.email) {
        const email = String(x.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ row: entry.row, message: 'Invalid email' });
        if (seenEmails.has(email)) errors.push({ row: entry.row, message: 'Duplicate email inside CSV' });
        seenEmails.add(email);
        emailCandidates.push(email);
        x.email = email;
      }
      if (x.type && !ALLOWED_TYPES.has(x.type)) errors.push({ row: entry.row, message: 'Invalid contact type' });
      if (x.status && !ALLOWED_STATUSES.has(x.status)) errors.push({ row: entry.row, message: 'Invalid contact status' });
      if (!x.type) x.type = 'CUSTOMER';
      if (!x.status) x.status = 'ACTIVE';
      if (!x.country) x.country = 'SA';
    }

    const existing = emailCandidates.length
      ? await prisma.contact.findMany({
          where: { ...scope, email: { in: emailCandidates, mode: 'insensitive' } },
          select: { email: true },
        })
      : [];
    const existingEmails = new Set(existing.map((x) => String(x.email || '').toLowerCase()).filter(Boolean));
    const duplicates = parsed
      .filter((entry) => entry.item.email && existingEmails.has(String(entry.item.email).toLowerCase()))
      .map((entry) => ({ row: entry.row, email: entry.item.email }));

    const preview = {
      totalRows: parsed.length,
      validRows: parsed.length - errors.length - duplicates.length,
      errors,
      duplicates,
    };
    if (dryRun) return { dryRun: true, ...preview };
    if (errors.length) throw new BadRequestException({ message: 'CSV validation failed', ...preview });

    const importable = parsed.filter(
      (entry) => !entry.item.email || !existingEmails.has(String(entry.item.email).toLowerCase()),
    );

    const created = await prisma.$transaction(
      importable.map((entry) =>
        prisma.contact.create({ data: { ...entry.item, tenantId } }),
      ),
    );

    return {
      dryRun: false,
      imported: created.length,
      skippedDuplicates: duplicates.length,
      totalRows: parsed.length,
      duplicates,
    };
  }
}
