import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
} from "next/font/google";

import "./globals.css";
import "./mobile.css";
import "./chat-bubbles.css";

import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/Toast";
import RouteProgress from "@/components/ui/RouteProgress";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Rx Box: Smart Pillbox",
    template: "%s | Rx Box: Smart Pillbox",
  },
  description:
    "Smart medication reminder and adherence monitoring system.",
  applicationName: "Rx Box: Smart Pillbox",
  icons: {
    icon: [
      {
        url: "/brand/icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/brand/icon.png",
    apple: "/brand/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans",
        inter.variable
      )}
      suppressHydrationWarning
    >
      <body
        className={`rx-app ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RouteProgress />

          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}