import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CalendarPanel } from "@/components/calendar-panel";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default function AdminCalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="A unified view of lectures, approved bookings and maintenance across buildings. All times West Africa Time (Africa/Accra)."
      />
      <CalendarPanel />
    </>
  );
}
