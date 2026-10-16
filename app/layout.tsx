import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verra",
  description: "AI local search for restaurants and retail",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
