import type { Metadata } from "next";
import "./globals.css";
import { sansFont, sansFontExt, displayFont, displayFontExt } from "./fonts";

export const metadata: Metadata = {
  title: "Declutter",
  description: "Track every possession. Know what to get rid of.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${sansFontExt.variable} ${displayFont.variable} ${displayFontExt.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
