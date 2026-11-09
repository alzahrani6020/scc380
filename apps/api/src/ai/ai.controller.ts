import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

class ChatDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  @IsIn(['crm'])
  context?: string;
}

class SummarizeDto {
  @IsString()
  @MaxLength(10000)
  text: string;
}

// Lightweight in-memory sliding-window rate limit (per user, no extra deps)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
const rateHits = new Map<string, number[]>();

function enforceRateLimit(key: string) {
  const now = Date.now();
  const arr = (rateHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    throw new HttpException('عدد المحاولات كبير — انتظر دقيقة وحاول مجدداً', HttpStatus.TOO_MANY_REQUESTS);
  }
  arr.push(now);
  rateHits.set(key, arr);
  if (rateHits.size > 5000) rateHits.clear(); // bound memory growth
}

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('chat')
  chat(@Req() req: any, @Body() dto: ChatDto) {
    enforceRateLimit(req.user?.userId || req.ip);
    return this.aiService.chat(dto.message, dto.context, req.user?.tenantId ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('summarize')
  summarize(@Req() req: any, @Body() dto: SummarizeDto) {
    enforceRateLimit(req.user?.userId || req.ip);
    return this.aiService.summarize(dto.text);
  }

  // Was publicly accessible — now requires auth like the rest of the module
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('models')
  getModels() {
    return this.aiService.getModels();
  }
}
