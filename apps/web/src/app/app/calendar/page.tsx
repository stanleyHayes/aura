import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CalendarPanel } from "@/components/calendar-panel";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Lectures, approved bookings and maintenance, colour-coded by source. All times West Africa Time (Africa/Accra)."
      />
      <CalendarPanel />
    </>
  );
}
