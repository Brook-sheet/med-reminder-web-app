import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
} from "next/font/google";

import "./globals.css";
import "./mobile.css";
import "./page-density.css";
import "./chat-bubbles.css";
import "./mobile-pwa.css";

import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/Toast";
import RouteProgress from "@/components/ui/RouteProgress";
import PwaRegistration from "@/components/pwa/PwaRegistration";
import splashScreens from "@/lib/pwa/splash.json";

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rx Box",
    statusBarStyle: "default",
    startupImage: splashScreens,
  },
  icons: {
    icon: [
      {
        url: "/brand/icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/brand/icon.png",
    apple: "/pwa/apple-touch-icon.png",
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
      className={cn("font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          const query = matchMedia('(display-mode: standalone)');
          const update = () => {
            const standalone = query.matches || navigator.standalone === true;
            document.documentElement.dataset.rxStandalone = String(standalone);
          };
          update();
          query.addEventListener('change', update);
          window.addEventListener('pageshow', update);
        })();` }} />
      </head>
      <body
        className={`rx-app ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PwaRegistration />
          <RouteProgress />

          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}