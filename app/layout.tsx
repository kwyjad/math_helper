import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

// Rounded, friendly display face for headings; clean readable sans for body.
// Exposed as CSS variables so the design tokens (globals.css) reference them.
const display = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dijits and Ijits",
  description:
    "Work through your math homework one problem at a time with a Socratic tutor.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12b3a6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
