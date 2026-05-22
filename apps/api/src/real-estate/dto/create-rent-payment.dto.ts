import { IsString, IsOptional, IsEnum, IsDecimal, IsDateString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class CreateRentPaymentDto {
  @IsString()
  contractId: string;

  @IsString()
  propertyId: string;

  @IsString()
  unitId: string;

  @IsDateString()
  dueDate: string;

  @IsDateString()
  @IsOptional()
  paidDate?: string;

  @IsDecimal()
  amount: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  transactionRef?: string;

  @IsString()
  @IsOptional()
  bankReference?: string;

  @IsString()
  @IsOptional()
  ejarPaymentRef?: string;

  @IsString()
  @IsOptional()
  invoiceId?: string;
}
