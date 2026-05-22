import { IsString, IsOptional, IsDecimal, IsDateString } from 'class-validator';

export class RecordPaymentDto {
  @IsDateString()
  paidDate: string;

  @IsDecimal()
  amount: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  transactionRef?: string;

  @IsString()
  @IsOptional()
  bankReference?: string;
}
