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
  return null;
}
