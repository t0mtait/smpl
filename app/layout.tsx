import type { Metadata } from "next";
import "./globals.css";
import { sansFont, displayFont } from "./fonts";

export const metadata: Metadata = {
  title: "Declutter",
  description: "Track every possession. Know what to get rid of.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sansFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
