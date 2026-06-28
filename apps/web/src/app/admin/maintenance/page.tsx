import type { Metadata } from "next";
import { MaintenanceClient } from "./maintenance-client";

export const metadata: Metadata = {
  title: "Maintenance windows",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return <MaintenanceClient />;
}
