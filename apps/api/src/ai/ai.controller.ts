import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('chat')
  async chat(@Request() req: any, @Body() body: { message: string; context?: string }) {
    return this.aiService.chat(body.message, body.context, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('summarize')
  async summarize(@Body() body: { text: string }) {
    return this.aiService.summarize(body.text);
  }

  @Get('models')
  async getModels() {
    return this.aiService.getModels();
  }
}
