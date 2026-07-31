import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#11152b",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Jarlath and Anya’s Times Table Turbo",
    description:
      "A touch-friendly multiplication and division game with solo, fact-family and live two-player modes.",
    applicationName: "Jarlath and Anya’s Times Table Turbo",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Jarlath + Anya Turbo",
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: "website",
      url: origin,
      title: "Jarlath and Anya’s Times Table Turbo",
      description: "Master times tables, connect division facts, or play live together.",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "Jarlath and Anya’s Times Table Turbo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Jarlath and Anya’s Times Table Turbo",
      description: "Master times tables, connect division facts, or play live together.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
