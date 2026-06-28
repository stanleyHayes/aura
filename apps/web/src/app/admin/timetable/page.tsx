import type { Metadata } from "next";
import { TimetableClient } from "./timetable-client";

export const metadata: Metadata = {
  title: "Timetable",
  robots: { index: false, follow: false },
};

export default function TimetablePage() {
  return <TimetableClient />;
}
