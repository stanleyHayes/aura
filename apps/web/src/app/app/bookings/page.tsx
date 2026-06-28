import type { Metadata } from "next";
import { MyBookingsClient } from "./bookings-client";

export const metadata: Metadata = {
  title: "My bookings",
  robots: { index: false, follow: false },
};

export default function BookingsPage() {
  return <MyBookingsClient />;
}
