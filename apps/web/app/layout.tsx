import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Suspense } from "react";
import { ToastProvider } from "@/components/Toast";
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

type Theme = "dark" | "light";

const THEME_COOKIE = "unmapped-theme";

function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    // suppressHydrationWarning: client components may still sync lang/theme from
    // browser state after hydration, but the first paint now uses the theme cookie.
    <html
      lang="en"
      data-theme={theme}
      style={{ colorScheme: theme }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg-base text-fg-primary">
        <Suspense fallback={null}>
          <HtmlLangSync />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
