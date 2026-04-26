import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ToastProvider } from "@/components/Toast";
import { ThemeNoFlashScript } from "@/components/ThemeToggle";
import HtmlLangSync from "@/components/HtmlLangSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNMAPPED, Open Skills Infrastructure",
  description:
    "Mapping the real skills of 600 million unmapped young people to real economic opportunity. Built for the World Bank Youth Summit × Hack-Nation Global AI Hackathon 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the no-flash script intentionally rewrites
    // data-theme + style.colorScheme before React hydrates, which would
    // otherwise trip a server/client attribute mismatch.
    <html
      lang="en"
      data-theme="light"
      style={{ colorScheme: "light" }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeNoFlashScript />
      </head>
      <body className="min-h-full flex flex-col bg-bg-base text-fg-primary">
        <Suspense fallback={null}>
          <HtmlLangSync />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
