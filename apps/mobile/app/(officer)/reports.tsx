/**
 * Reports tab (Section 7.9) — mobile parity with the web admin reports. Thin
 * route file delegating to the feature component, matching the app's screen
 * convention (see `(officer)/settings.tsx`). The "reports" tab itself is
 * registered in `(officer)/_layout.tsx`.
 */
import { ReportsScreen } from '@/features/reports-screen';

export default function OfficerReports() {
  return <ReportsScreen />;
}
