import { redirect } from 'next/navigation';

// Keep legacy bookmarks working; all owner operations now live in /owner.
export default function LegacyOwnerFiles() {
  redirect('/owner?tab=files');
}
