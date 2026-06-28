import type { Metadata } from "next";
import { EquipmentClient } from "./equipment-client";

export const metadata: Metadata = {
  title: "Equipment",
  robots: { index: false, follow: false },
};

export default function EquipmentPage() {
  return <EquipmentClient />;
}
