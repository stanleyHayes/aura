import type { Metadata } from "next";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsClient />;
}
