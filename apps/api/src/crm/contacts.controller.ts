import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContactsService } from './contacts.service';

@ApiTags('CRM - Contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(@Request() req, @Query('type') type?: string, @Query('search') search?: string, @Query('status') status?: string) {
    return this.contactsService.findAll(req.user.tenantId, req.user.role, { type, search, status });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.contactsService.findOne(req.user.tenantId, req.user.role, id);
  }

  @Post()
  create(@Request() req, @Body() body: any) {
    return this.contactsService.create(req.user.tenantId, req.user.role, body);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.contactsService.update(req.user.tenantId, req.user.role, id, body);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.contactsService.delete(req.user.tenantId, req.user.role, id);
  }
}
