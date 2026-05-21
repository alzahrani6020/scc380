import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, tenantWhere } from '@scc/database';

@Injectable()
export class ConversationsService {
  async findAll(req: any) {
    const where = tenantWhere(req);
    const [data, count] = await Promise.all([
      prisma.aIConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.aIConversation.count({ where }),
    ]);
    return { data, count };
  }

  async findOne(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const item = await prisma.aIConversation.findFirst({
      where,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!item) throw new NotFoundException('Conversation not found');
    return item;
  }

  async create(req: any, dto: any) {
    return prisma.aIConversation.create({
      data: {
        ...dto,
        tenantId: req.tenantId || req.user?.tenantId,
      },
    });
  }

  async remove(req: any, id: string) {
    const where = { ...tenantWhere(req), id };
    const existing = await prisma.aIConversation.findFirst({ where });
    if (!existing) throw new NotFoundException('Conversation not found');
    return prisma.aIConversation.delete({ where: { id } });
  }

  async addMessage(req: any, conversationId: string, dto: any) {
    const where = { ...tenantWhere(req), id: conversationId };
    const conv = await prisma.aIConversation.findFirst({ where });
    if (!conv) throw new NotFoundException('Conversation not found');
    return prisma.aIMessage.create({
      data: {
        ...dto,
        role: dto.role || 'USER',
        tenantId: req.tenantId || req.user?.tenantId,
        conversationId,
      },
    });
  }

  async getMessages(req: any, conversationId: string) {
    const where = { ...tenantWhere(req), conversationId };
    const data = await prisma.aIMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return { data, count: data.length };
  }
}
