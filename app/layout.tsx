import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

// Codes and big numbers only; Chinese UI text uses system fonts.
const barlowCondensed = Barlow_Condensed({
  weight: "600",
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "倉庫工作台",
  appleWebApp: {
    capable: true,
    title: "倉庫",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F3" },
    { media: "(prefers-color-scheme: dark)", color: "#16181B" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={barlowCondensed.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
