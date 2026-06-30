import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

// Re-mounted on every navigation within the (auth) group, so the page-enter
// animation replays when moving between login / forgot / reset.
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
