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
  title: "NEON GENESIS ARCHIVE",
  description: "Advanced MAGI Protocol - Neural Interface Planner",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
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
    <html lang="en" className="dark overflow-x-hidden" data-theme="dark" style={{ scrollbarGutter: 'stable' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg-main)] text-[var(--text-primary)] min-h-screen overflow-x-hidden flex flex-col`}
      >
        {/* Issue B: Side Edges Fixed Positioning */}
        <div className="fixed inset-y-0 left-0 w-8 z-50 pointer-events-none hidden 2xl:flex flex-col items-center justify-between py-10 opacity-30">
           <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--eva-green)] to-transparent" />
        </div>
        <div className="fixed inset-y-0 right-0 w-8 z-50 pointer-events-none hidden 2xl:flex flex-col items-center justify-between py-10 opacity-30">
           <div className="w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--eva-green)] to-transparent" />
        </div>

        {/* Background Animation & Scanlines */}
        <div className="eva-bg-animation fixed inset-0 z-[-1]" />
        <div className="eva-scanline fixed inset-0 z-[1000]" />
        
        <main className="flex-1 flex flex-col relative z-10 force-layer">
          {children}
        </main>
      </body>
    </html>
  );
}
