import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private ollamaUrl: string;

  constructor(private config: ConfigService) {
    this.ollamaUrl = this.config.get('OLLAMA_URL') || 'http://localhost:11434';
  }

  async chat(message: string, context?: string) {
    try {
      const systemPrompt = context === 'crm'
        ? 'You are an AI assistant for a CRM/ERP system called Smart Command Center (SCC 380). Help users with business operations, customer management, and analytics. Answer in Arabic or English based on the user query.'
        : 'You are a helpful AI assistant. Answer concisely.';

      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const data = await response.json();
      return {
        response: data.response?.trim() || 'لم أفهم، هل يمكنك التوضيح؟',
        model: 'tinyllama',
      };
    } catch (error) {
      return {
        response: 'عذراً، خدمة الذكاء الاصطناعي غير متوفرة حالياً. تأكد من تشغيل Ollama.',
        model: 'tinyllama',
        fallback: true,
      };
    }
  }

  async summarize(text: string) {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tinyllama',
          prompt: `Summarize the following text in Arabic:\n\n${text}\n\nSummary:`,
          stream: false,
          options: { temperature: 0.5, num_predict: 200 },
        }),
      });

      const data = await response.json();
      return {
        response: data.response?.trim() || 'تعذر تلخيص النص.',
        model: 'tinyllama',
      };
    } catch (error) {
      return {
        response: 'عذراً، خدمة التلخيص غير متوفرة.',
        model: 'tinyllama',
        fallback: true,
      };
    }
  }

  async getModels() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      const data = await response.json();
      return { models: data.models?.map((m: any) => m.name) || [] };
    } catch {
      return { models: ['tinyllama'] };
    }
  }
}
