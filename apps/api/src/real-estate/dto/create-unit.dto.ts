import { IsString, IsOptional, IsEnum, IsInt, IsDecimal } from 'class-validator';
import { UnitType, UnitStatus } from '@prisma/client';

export class CreateUnitDto {
  @IsString()
  propertyId: string;

  @IsString()
  unitNumber: string;

  @IsInt()
  @IsOptional()
  floor?: number;

  @IsEnum(UnitType)
  @IsOptional()
  unitType?: UnitType;

  @IsEnum(UnitStatus)
  @IsOptional()
  status?: UnitStatus;

  @IsDecimal()
  @IsOptional()
  areaSqm?: string;

  @IsInt()
  @IsOptional()
  bedrooms?: number;

  @IsInt()
  @IsOptional()
  bathrooms?: number;

  @IsDecimal()
  @IsOptional()
  rentAmountMonthly?: string;
}
