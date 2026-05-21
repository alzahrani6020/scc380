import { IsString, IsOptional, IsDecimal, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsDecimal()
  costPrice?: string;

  @IsOptional()
  @IsDecimal()
  salePrice?: string;

  @IsOptional()
  @IsDecimal()
  wholesalePrice?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isService?: boolean;

  @IsOptional()
  @IsDecimal()
  taxRate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CreateWarehouseDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateStockMovementDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsString()
  type: 'IN' | 'OUT' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER';

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsDecimal()
  unitCost?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
