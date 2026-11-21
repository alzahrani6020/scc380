'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

// Only record navigation after a signed-in API request succeeds.
// Do not send query strings, credentials, or browser identifiers.
export default function ActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname?.startsWith('/dashboard')) return;
    api.post('/analytics/activity/event', { action: 'PAGE_VIEW', path: pathname })
      .catch(() => {
        // Tracking is non-blocking; never disrupt normal navigation.
      });
  }, [pathname]);
  useEffect(() => {
    const recordDownloads = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const hasDownload = link.hasAttribute('download');
      let resource: URL;
      try { resource = new URL(link.href, window.location.href); } catch { return; }
      const fileLink = /\.(pdf|csv|xlsx?|docx?|zip|png|jpe?g)$/i.test(resource.pathname);
      if (!hasDownload && !fileLink) return;
      if (resource.origin !== window.location.origin) return;
      const path = window.location.pathname;
      if (!path.startsWith('/dashboard')) return;
      void api.post('/analytics/activity/event', { action: 'DOWNLOAD_REQUEST', path }).catch(() => {});
    };
    document.addEventListener('click', recordDownloads, true);
    return () => document.removeEventListener('click', recordDownloads, true);
  }, []);
  return null;
}
