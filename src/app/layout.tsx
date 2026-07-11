import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Arapey } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from './_components/ThemeProvider'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const arapey = Arapey({
  variable: "--font-arapey",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ecosystem — Earlyseed Ventures",
  description: "Unified deal pipeline and CRM platform for Earlyseed Ventures.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility; don't lock scale.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }} suppressHydrationWarning>
      <head>
        {/* Runs before React hydrates to prevent theme flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var stored = localStorage.getItem('esv-theme');
            document.documentElement.setAttribute('data-theme', stored || 'light');
          })();
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${arapey.variable}`}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
