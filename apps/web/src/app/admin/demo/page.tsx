'use client';

import { useState } from 'react';

export default function DemoGenerator() {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const token = btoa(JSON.stringify({
      secret: 'scc-demo-secret-2024',
      exp: Date.now() + (24 * 60 * 60 * 1000),
      id: 'demo-' + Math.random().toString(36).slice(2, 8)
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    setLink(`https://scc380-web.vercel.app/landing?demo=${token}`);
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6" dir="rtl">
      <div className="w-full max-w-lg p-8 bg-slate-900 rounded-2xl border border-slate-800">
        <h1 className="text-2xl font-bold text-white text-center mb-6">توليد رابط Demo</h1>
        
        <button
          onClick={generate}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mb-6"
        >
          توليد رابط جديد
        </button>

        {link && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-800 rounded-lg break-all text-sm text-blue-300">
              {link}
            </div>
            <button
              onClick={copy}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              {copied ? '✅ تم النسخ' : 'نسخ الرابط'}
            </button>
            <p className="text-slate-400 text-sm text-center">
              الرابط يعمل مرة واحدة فقط | صالح لمدة 24 ساعة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
