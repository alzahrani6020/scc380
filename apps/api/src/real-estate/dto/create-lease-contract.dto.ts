import { IsString, IsOptional, IsEnum, IsDecimal, IsDateString, IsBoolean, IsInt } from 'class-validator';
import { LeaseType, LeaseStatus, PaymentFrequency } from '@prisma/client';

export class CreateLeaseContractDto {
  @IsString()
  propertyId: string;

  @IsString()
  unitId: string;

  @IsString()
  @IsOptional()
  ejarContractNumber?: string;

  @IsEnum(LeaseType)
  @IsOptional()
  contractType?: LeaseType;

  @IsString()
  @IsOptional()
  lessorId?: string;

  @IsString()
  @IsOptional()
  lesseeId?: string;

  @IsString()
  lessorName: string;

  @IsString()
  lessorIdNumber: string;

  @IsString()
  @IsOptional()
  lessorPhone?: string;

  @IsString()
  lesseeName: string;

  @IsString()
  lesseeIdNumber: string;

  @IsString()
  @IsOptional()
  lesseePhone?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsDecimal()
  rentAmount: string;

  @IsEnum(PaymentFrequency)
  @IsOptional()
  paymentFrequency?: PaymentFrequency;

  @IsDecimal()
  @IsOptional()
  securityDeposit?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  @IsInt()
  @IsOptional()
  renewalNoticeDays?: number;
}
