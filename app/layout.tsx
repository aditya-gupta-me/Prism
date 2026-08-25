import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Prism — Browser-Native Cloud IDE",
    template: "%s | Prism",
  },
  description:
    "Prism is a browser-native cloud IDE for full-stack web development. Write, run, and preview Node.js applications with AI assistance and zero local setup.",
  applicationName: "Prism",
  keywords: [
    "browser-native IDE",
    "cloud IDE",
    "online code editor",
    "WebContainers",
    "AI coding agent",
    "Node.js in browser",
    "full-stack web development",
    "CodeMirror 6",
  ],
  authors: [{ name: "Prism" }],
  creator: "Prism",
  publisher: "Prism",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Prism",
    title: "Prism — Browser-Native Cloud IDE",
    description:
      "Write, run, and preview full-stack Node.js applications in your browser with real-time AI assistance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prism — Browser-Native Cloud IDE",
    description:
      "Write, run, and preview full-stack Node.js applications in your browser with real-time AI assistance.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/prism.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${plexMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
