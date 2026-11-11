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

  @Get()
  @RequirePermissions('crm:read')
  findAll(@Request() req, @Query() query: ListContactsQueryDto) {
    return this.contactsService.findAll(req.user.tenantId, req.user.role, query);
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  findOne(@Request() req, @Param('id') id: string) {
    return this.contactsService.findOne(req.user.tenantId, req.user.role, id);
  }

  @Post()
  @RequirePermissions('crm:write')
  create(@Request() req, @Body() body: CreateContactDto) {
    return this.contactsService.create(req.user.tenantId, req.user.role, body);
  }

  @Patch(':id')
  @RequirePermissions('crm:write')
  update(@Request() req, @Param('id') id: string, @Body() body: UpdateContactDto) {
    return this.contactsService.update(req.user.tenantId, req.user.role, id, body);
  }

  @Delete(':id')
  @RequirePermissions('crm:write')
  remove(@Request() req, @Param('id') id: string) {
    return this.contactsService.delete(req.user.tenantId, req.user.role, id);
  }
}
