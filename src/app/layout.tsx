// ===== Root Layout =====
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Defense",
  description: "A pixel art tower defense game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
