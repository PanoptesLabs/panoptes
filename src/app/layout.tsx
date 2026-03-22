import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://panoptes.cc"
  ),
  title: {
    default: "Panoptes - Chain Intelligence, Unblinking",
    template: "%s | Panoptes",
  },
  description:
    "Chain intelligence platform for Republic AI ecosystem. Validator monitoring, endpoint health tracking, smart routing, and anomaly detection.",
  keywords: [
    "Republic AI",
    "validator",
    "monitoring",
    "blockchain",
    "cosmos",
    "chain intelligence",
    "endpoint health",
    "smart routing",
    "anomaly detection",
  ],
  authors: [{ name: "PanoptesLabs" }],
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon",
  },
  other: {
    "theme-color": "#1C0F2B",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Panoptes - Chain Intelligence, Unblinking",
    description:
      "Chain intelligence platform for Republic AI. Validator monitoring, endpoint health, smart routing, and anomaly detection.",
    siteName: "Panoptes",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panoptes - Chain Intelligence, Unblinking",
    description:
      "Chain intelligence platform for Republic AI. Validator monitoring, endpoint health, smart routing, and anomaly detection.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Panoptes",
  description:
    "Chain intelligence platform for Republic AI ecosystem. Validator monitoring, endpoint health tracking, smart routing, and anomaly detection.",
  applicationCategory: "Blockchain Tool",
  operatingSystem: "Web",
  author: { "@type": "Person", name: "PanoptesLabs" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        {/* eslint-disable react/no-danger -- structured data requires dangerouslySetInnerHTML */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* eslint-enable react/no-danger */}
      </head>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-body antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-soft-violet focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
        >
          Skip to main content
        </a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
