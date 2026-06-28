import type { Metadata } from "next";
import { SemestersClient } from "./semesters-client";

export const metadata: Metadata = {
  title: "Semesters",
  robots: { index: false, follow: false },
};

export default function SemestersPage() {
  return <SemestersClient />;
}
