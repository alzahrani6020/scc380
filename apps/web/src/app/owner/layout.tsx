import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

function getOwnerApiOrigin(): string {
  const configured = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  // Never call a relative URL from a server component.
  const origin = configured && /^https?:\/\//.test(configured)
    ? configured
    : 'https://scc380-api.onrender.com';
  return origin.replace(/\/+$/, '').replace(/\/api$/, '');
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // The owner page must never render until NestJS authorizes the exact live
  // session. Middleware's unsigned cookie inspection is NOT sufficient.
  const token = cookies().get('accessToken')?.value;
  if (!token || token.split('.').length !== 3) notFound();

  try {
    const response = await fetch(getOwnerApiOrigin() + '/analytics/activity/owner/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) notFound();
    const result = (await response.json()) as { authorized?: boolean };
    if (result.authorized !== true) notFound();
  } catch {
    // Never fall back to client-only controls on errors or outages.
    notFound();
  }

  return <>{children}</>;
}
