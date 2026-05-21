import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SCC Admin | لوحة المشرف',
  description: 'Smart Command Center Super Admin Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>{children}</body>
    </html>
  );
}
