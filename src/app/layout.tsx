import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "MetaGross — VGC Battle Intelligence",
  description:
    "Supercomputer-level team intelligence for Pokemon VGC. AI-powered battle analysis, team building, and coaching.",
  appleWebApp: {
    capable: true,
    title: "MetaGross",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow user pinch-zoom (iOS accessibility) — don't disable scaling.
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  // Use the safe-area insets on iPhones (notch + home indicator).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Nav />
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
