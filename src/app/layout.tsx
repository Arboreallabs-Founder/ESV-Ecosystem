import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Arapey } from "next/font/google";
import Script from 'next/script'
import "flag-icons/css/flag-icons.min.css";
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
  title: "Ecosystem",
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
        {/*
          Sets the theme attribute before React hydrates, so the page never paints in the wrong
          theme and then snaps.

          Routed through next/script rather than a bare <script> element: React 19 warns when it
          meets a script tag while rendering, because on a client-side render — as opposed to
          hydration — the tag is inserted but never executed. That warning is noise for a root
          layout, but next/script is the supported way to say "this is a real script, hoist it",
          and it keeps the console clean enough that a genuine warning still stands out.
        */}
        <Script id="esv-theme-init" strategy="beforeInteractive">
          {`(function(){
            var stored = localStorage.getItem('esv-theme');
            document.documentElement.setAttribute('data-theme', stored || 'light');
          })();`}
        </Script>
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
