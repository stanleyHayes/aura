import type { Metadata } from "next";
import { RoomsClient } from "./rooms-client";

export const metadata: Metadata = {
  title: "Rooms",
  robots: { index: false, follow: false },
};

export default function RoomsPage() {
  return <RoomsClient />;
}
