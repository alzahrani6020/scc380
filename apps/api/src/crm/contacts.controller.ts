import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../auth/guards/permissions.guard';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';

@ApiTags('CRM - Contacts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  private tenantIdFor(req: any): string | undefined {
    return req.user?.role === 'SUPER_ADMIN' ? req.tenantId : req.user?.tenantId;
  }

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Request() req: any, @Query() query: ListContactsQueryDto) {
    return this.contactsService.findAll(this.tenantIdFor(req), req.user.role, query);
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.contactsService.findOne(this.tenantIdFor(req), req.user.role, id);
  }

  @Post()
  @RequirePermissions('crm:write')
  create(@Request() req: any, @Body() body: CreateContactDto) {
    return this.contactsService.create(this.tenantIdFor(req), req.user.role, body);
  }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Request() req: any, @Param('id') id: string, @Body() body: UpdateContactDto) {
    return this.contactsService.update(this.tenantIdFor(req), req.user.role, id, body);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.contactsService.delete(this.tenantIdFor(req), req.user.role, id);
  }
}
