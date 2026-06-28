import type { Metadata } from "next";
import { ApprovalsClient } from "./approvals-client";

export const metadata: Metadata = {
  title: "Approvals",
  robots: { index: false, follow: false },
};

export default function ApprovalsPage() {
  return <ApprovalsClient />;
}
