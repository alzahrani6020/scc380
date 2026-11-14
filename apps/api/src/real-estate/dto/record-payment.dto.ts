import { IsString, IsOptional, IsDecimal, IsDateString, Length, Matches } from 'class-validator';

export class RecordPaymentDto {
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  idempotencyKey: string;

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
