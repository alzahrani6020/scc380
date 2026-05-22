import { IsString, IsOptional, IsEnum, IsDecimal, IsDateString } from 'class-validator';
import { PropertyType, PropertyStatus } from '@prisma/client';

export class CreatePropertyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsEnum(PropertyStatus)
  @IsOptional()
  status?: PropertyStatus;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  buildingNumber?: string;

  @IsDecimal()
  @IsOptional()
  latitude?: string;

  @IsDecimal()
  @IsOptional()
  longitude?: string;

  @IsString()
  @IsOptional()
  deedNumber?: string;

  @IsString()
  @IsOptional()
  deedFileUrl?: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  ownerIdNumber?: string;

  @IsString()
  @IsOptional()
  ownerPhone?: string;

  @IsString()
  @IsOptional()
  regaLicenseNumber?: string;

  @IsDateString()
  @IsOptional()
  acquisitionDate?: string;

  @IsDecimal()
  @IsOptional()
  acquisitionCost?: string;

  @IsDecimal()
  @IsOptional()
  totalAreaSqm?: string;
}
