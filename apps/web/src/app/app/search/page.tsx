import type { Metadata } from "next";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Find a room",
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return <SearchClient />;
}
