import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "倉庫工作台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
