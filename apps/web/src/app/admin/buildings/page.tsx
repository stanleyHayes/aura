import type { Metadata } from "next";
import { BuildingsClient } from "./buildings-client";

export const metadata: Metadata = {
  title: "Buildings",
  robots: { index: false, follow: false },
};

export default function BuildingsPage() {
  return <BuildingsClient />;
}
