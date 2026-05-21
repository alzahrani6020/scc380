import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { CreateCategoryDto, CreateProductDto, CreateStockMovementDto, CreateWarehouseDto } from './dto/create-product.dto';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private service: InventoryService) {}

  // ─── Products ───
  @Get('products')
  findAllProducts(@Request() req: any) {
    return this.service.findAllProducts(req.user.tenantId, req.user.role);
  }

  @Get('products/:id')
  findProduct(@Param('id') id: string, @Request() req: any) {
    return this.service.findProductById(id, req.user.tenantId, req.user.role);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto, @Request() req: any) {
    return this.service.createProduct(dto, req.user.tenantId, req.user.role);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>, @Request() req: any) {
    return this.service.updateProduct(id, dto, req.user.tenantId, req.user.role);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteProduct(id, req.user.tenantId, req.user.role);
  }

  // ─── Categories ───
  @Get('categories')
  findAllCategories(@Request() req: any) {
    return this.service.findAllCategories(req.user.tenantId, req.user.role);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto, @Request() req: any) {
    return this.service.createCategory(dto, req.user.tenantId, req.user.role);
  }

  // ─── Warehouses ───
  @Get('warehouses')
  findAllWarehouses(@Request() req: any) {
    return this.service.findAllWarehouses(req.user.tenantId, req.user.role);
  }

  @Post('warehouses')
  createWarehouse(@Body() dto: CreateWarehouseDto, @Request() req: any) {
    return this.service.createWarehouse(dto, req.user.tenantId, req.user.role);
  }

  // ─── Stock Movements ───
  @Get('movements')
  findAllMovements(@Request() req: any) {
    return this.service.findAllMovements(req.user.tenantId, req.user.role);
  }

  @Post('movements')
  createMovement(@Body() dto: CreateStockMovementDto, @Request() req: any) {
    return this.service.createMovement(dto, req.user.tenantId, req.user.role);
  }

  // ─── Stats ───
  @Get('stats')
  getStats(@Request() req: any) {
    return this.service.getInventoryStats(req.user.tenantId, req.user.role);
  }
}
