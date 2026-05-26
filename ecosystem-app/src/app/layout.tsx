import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ecosystem — Earlyseed Ventures",
  description: "Unified deal pipeline and CRM platform for Earlyseed Ventures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        {children}
      </body>
    </html>
  );
}
