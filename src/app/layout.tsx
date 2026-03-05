import type { Metadata, Viewport } from "next";
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
  title: "AI Daily Planner",
  description: "Intelligent AI-driven daily planner and knowledge base",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Daily Planner",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg-main)] text-[var(--text-primary)] relative`}
      >
        {/* Issue B: Side Edges Fixed Positioning */}
        <div className="fixed inset-y-0 left-0 w-8 z-50 pointer-events-none hidden lg:flex flex-col items-center justify-between py-10 opacity-40">
           <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--eva-green)] to-transparent" />
        </div>
        <div className="fixed inset-y-0 right-0 w-8 z-50 pointer-events-none hidden lg:flex flex-col items-center justify-between py-10 opacity-40">
           <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--eva-green)] to-transparent" />
        </div>

        {/* Background Animation & Scanlines */}
        <div className="eva-bg-animation" />
        <div className="eva-scanline" />
        
        <main className="relative z-10 force-layer">
          {children}
        </main>
      </body>
    </html>
  );
}
