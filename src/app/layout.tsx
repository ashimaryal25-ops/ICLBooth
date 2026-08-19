import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "react-simple-keyboard/build/css/index.css";
import "./globals.css";
import { KioskGuard } from "@/components/KioskGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ICLBooth | Gettysburg College Edition",
  description: "Photo booth kiosk that turns Gettysburg College portraits into collectible cards.",
};

// Lock the viewport: guests (or ghost touches) can't pinch-zoom the whole page
// out of the kiosk layout. Pairs with the gesture lockdown in globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <KioskGuard />
        {children}
      </body>
    </html>
  );
}
