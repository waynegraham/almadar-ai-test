import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Almadar Manuscript Explorer",
  description:
    "Explore manuscript pages, transcriptions, and ALTO regions with IIIF.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
