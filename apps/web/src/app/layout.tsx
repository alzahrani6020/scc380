import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SCC | مركز القيادة الذكي',
  description: 'Hybrid Multi-Tenant SaaS Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('contextmenu', e => e.preventDefault());
              document.addEventListener('copy', e => e.preventDefault());
              document.addEventListener('cut', e => e.preventDefault());
              document.addEventListener('selectstart', e => e.preventDefault());
              document.addEventListener('keydown', e => {
                if (e.key === 'F12') e.preventDefault();
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) e.preventDefault();
                if (e.ctrlKey && e.key === 'u') e.preventDefault();
                if (e.ctrlKey && e.key === 's') e.preventDefault();
                if (e.ctrlKey && e.key === 'p') e.preventDefault();
              });
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
