import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Mirrors ContactType / ContactStatus in packages/database/prisma/schema.prisma
export const CONTACT_TYPES = ['CUSTOMER', 'LEAD', 'PROSPECT', 'PARTNER', 'SUPPLIER', 'VENDOR'] as const;
export const CONTACT_STATUSES = ['ACTIVE', 'INACTIVE', 'CONVERTED', 'BLACKLISTED'] as const;

// The form submits '' for untouched optional fields — treat empty string as absent.
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  phone2?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  idNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  crNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsIn(CONTACT_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsIn(CONTACT_STATUSES as unknown as string[])
  status?: string;

  // Only honored by the service for SUPER_ADMIN; every other role is forced
  // onto their own tenantId server-side. No id/createdAt/updatedAt here by design.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenantId?: string;
}
