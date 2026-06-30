import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

// Re-mounted on every navigation within the (public) group, so the page-enter
// animation replays on each route change.
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
