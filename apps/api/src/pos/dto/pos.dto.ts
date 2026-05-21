import { IsString, IsOptional, IsDecimal, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PosOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  productName: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsDecimal()
  unitPrice: string;

  @IsOptional()
  @IsDecimal()
  discount?: string;

  @IsOptional()
  @IsDecimal()
  taxRate?: string;
}

export class PosPaymentDto {
  @IsString()
  method: string;

  @IsDecimal()
  amount: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreatePosOrderDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments: PosPaymentDto[];
}

export class CreatePosSessionDto {
  @IsDecimal()
  openingCash: string;

  @IsOptional()
  @IsString()
  posTerminal?: string;
}

export class ClosePosSessionDto {
  @IsDecimal()
  closingCash: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
