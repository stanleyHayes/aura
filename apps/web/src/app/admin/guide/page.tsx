import type { Metadata } from "next";
import { UserGuidePage } from "@/components/user-guide-page";

export const metadata: Metadata = {
  title: "User guide",
  robots: { index: false, follow: false },
};

export default function AdminGuidePage() {
  return <UserGuidePage basePath="/admin" />;
}
