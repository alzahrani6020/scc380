import { IsString, IsOptional, IsInt, IsDecimal, IsEnum, IsDateString } from 'class-validator';
import { VehicleStatus, OwnershipType, PlateType, FuelType } from '@prisma/client';

export class CreateVehicleDto {
  @IsString()
  plateNumber: string;

  @IsEnum(PlateType)
  @IsOptional()
  plateType?: PlateType;

  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  vin?: string;

  @IsString()
  @IsOptional()
  imei?: string;

  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;

  @IsEnum(OwnershipType)
  @IsOptional()
  ownershipType?: OwnershipType;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  assignedDriverId?: string;

  @IsDateString()
  @IsOptional()
  istimaraExpiry?: string;

  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;

  @IsDateString()
  @IsOptional()
  periodicInspectionExpiry?: string;

  @IsEnum(FuelType)
  @IsOptional()
  fuelType?: FuelType;

  // TGA / Wassl fields
  @IsString()
  @IsOptional()
  tgaOperatingLicense?: string;

  @IsDateString()
  @IsOptional()
  tgaLicenseExpiry?: string;

  @IsDecimal()
  @IsOptional()
  loadCapacityKg?: string;

  @IsInt()
  @IsOptional()
  axleCount?: number;

  @IsString()
  @IsOptional()
  euroClass?: string;

  @IsString()
  @IsOptional()
  vehicleCategory?: string;

  @IsDecimal()
  @IsOptional()
  maxSpeedLimit?: string;

  @IsString()
  @IsOptional()
  gpsDeviceId?: string;

  @IsString()
  @IsOptional()
  gpsProvider?: string;
}
