import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'بوابة العميل | SCC',
  description: 'Client Portal',
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-white antialiased min-h-screen">{children}</body>
    </html>
  );
}
