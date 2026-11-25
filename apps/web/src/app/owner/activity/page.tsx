import { redirect } from 'next/navigation';

// Keep legacy bookmarks working; all owner operations now live in /owner.
export default function LegacyOwnerActivity() {
  redirect('/owner?tab=activity');
}
