import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InsightsService } from './insights.service';

const LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class AiService {
  private ollamaUrl: string | null;
  private logger = new Logger('AiService');

  constructor(
    private config: ConfigService,
    private insights: InsightsService,
  ) {
    const configuredOllamaUrl = this.config.get<string>('OLLAMA_URL')?.trim();
    this.ollamaUrl = configuredOllamaUrl || null;
  }

  async chat(message: string, context?: string, tenantId?: string | null) {
    // 1) Rule-based answer from the tenant's own data — always available,
    //    accurate, and needs no LLM provider
    try {
      const insight = await this.insights.tryAnswer(message, tenantId ?? null);
      if (insight) {
        return { response: insight, model: 'scc-insights', source: 'database' };
      }
      this.logger.warn(`Insights returned no match for: ${message?.slice(0, 60)}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error('Insights path failed', detail);
      // Surface the failure in the response (internal tool — aids ops debugging)
      return {
        response: `insights-error: ${detail}`,
        model: 'scc-insights',
        source: 'database',
        error: detail,
      };
    }

    // 2) LLM path is optional. Do not attempt localhost when no provider is configured.
    if (!this.ollamaUrl) {
      return {
        response:
          'أستطيع الإجابة عن أسئلة بيانات منشأتك (فواتير، إيرادات، مركبات، صفقات، تنبيهات، عدّادات). ' +
          'أما الأسئلة العامة فتتطلب تفعيل خدمة نموذج لغوي خارجية.',
        model: null,
        source: 'none',
        fallback: true,
      };
    }

    try {
      const systemPrompt = context === 'crm'
        ? 'You are an AI assistant for a CRM/ERP system called Smart Command Center (SCC 380). Help users with business operations, customer management, and analytics. Answer in Arabic or English based on the user query.'
        : 'You are a helpful AI assistant. Answer concisely.';

      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
          model: 'tinyllama',
          prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 300,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data: any = await response.json();
      return {
        response: data.response?.trim() || 'لم أفهم، هل يمكنك التوضيح؟',
        model: 'tinyllama',
        source: 'llm',
      };
    } catch (error) {
      this.logger.error(
        'LLM chat unavailable',
        error instanceof Error ? error.message : undefined,
      );
      return {
        response:
          'أستطيع الإجابة عن أسئلة بيانات منشأتك (فواتير، إيرادات، مركبات، صفقات، تنبيهات، عدّادات). ' +
          'أما الأسئلة العامة فتتطلب تفعيل خدمة النموذج اللغوي (Ollama أو بديل سحابي).',
        model: null,
        source: 'none',
        fallback: true,
      };
    }
  }

  async summarize(text: string) {
    const trimmed = (text || '').trim().slice(0, 10_000);
    if (!this.ollamaUrl) {
      return {
        response: 'عذراً، خدمة التلخيص غير متوفرة حالياً.',
        model: null,
        fallback: true,
      };
    }

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
          model: 'tinyllama',
          prompt: `Summarize the following text in Arabic:\n\n${trimmed}\n\nSummary:`,
          stream: false,
          options: { temperature: 0.5, num_predict: 200 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data: any = await response.json();
      return {
        response: data.response?.trim() || 'تعذر تلخيص النص.',
        model: 'tinyllama',
      };
    } catch (error) {
      this.logger.error(
        'Summarize unavailable',
        error instanceof Error ? error.message : undefined,
      );
      return {
        response: 'عذراً، خدمة التلخيص غير متوفرة حالياً.',
        model: 'tinyllama',
        fallback: true,
      };
    }
  }

  async getModels() {
    if (!this.ollamaUrl) return { models: [] };

    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data: any = await response.json();
      return { models: data.models?.map((m: any) => m.name) || [] };
    } catch {
      return { models: [] };
    }
  }
}
