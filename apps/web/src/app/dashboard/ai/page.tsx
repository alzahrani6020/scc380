'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Bot, Send, Sparkles, User } from 'lucide-react';

export default function AiPage() {
  const [messages, setMessages] = useState<{role: string; text: string}[]>([
    { role: 'ai', text: 'مرحباً! أنا المساعد الذكي لـ SCC 380. كيف يمكنني مساعدتك اليوم؟' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: userMsg, context: 'crm' });
      setMessages((prev) => [...prev, { role: 'ai', text: res.data.response || '...' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in-up h-[calc(100vh-140px)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary-400" />
          المساعد الذكي
        </h1>
        <p className="text-slate-400 text-sm mt-1">AI Powered Assistant - مدعوم بنموذج Llama 3</p>
      </div>

      <div className="scc-card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.role === 'ai' ? 'bg-gradient-to-br from-primary-500 to-primary-700' : 'bg-gradient-to-br from-slate-600 to-slate-700'
              }`}>
                {m.role === 'ai' ? <Sparkles className="h-4 w-4 text-white" /> : <User className="h-4 w-4 text-white" />}
              </div>
              <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                m.role === 'ai' ? 'bg-slate-800 text-slate-200' : 'bg-primary-600/20 text-primary-200 border border-primary-500/20'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="bg-slate-800 p-3 rounded-xl text-sm text-slate-400">جاري الكتابة...</div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="اكتب رسالتك هنا..."
            className="scc-input flex-1"
          />
          <button onClick={send} disabled={loading} className="scc-btn-primary px-4">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
