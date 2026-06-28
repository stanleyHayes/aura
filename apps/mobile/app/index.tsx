/**
 * Entry redirect. Routes authenticated users to the correct home group based on
 * role: booking officers land on the approvals queue, everyone else on search.
 */
import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/ui';
import { useAuth, useIsOfficer } from '@/features/auth/auth-context';

export default function Index() {
  const { status } = useAuth();
  const isOfficer = useIsOfficer();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated') return <Redirect href="/(auth)/login" />;

  // Officers default to the approvals view; both roles can navigate everywhere
  // their permissions allow via the tab bar.
  if (isOfficer) return <Redirect href="/(officer)/approvals" />;
  return <Redirect href="/(requester)/search" />;
}
