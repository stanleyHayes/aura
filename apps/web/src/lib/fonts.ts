import { Inter, Fraunces } from "next/font/google";

/** Body sans (§10.2, §12.4 next/font for CLS-safe loading). */
export const fontSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Serif display for headings — institutional but warm. */
export const fontSerif = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});
