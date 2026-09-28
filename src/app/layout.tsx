import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ProgressProvider } from "@/client/progress-provider";
import { THEME_SCRIPT } from "@/client/theme-script";
import { SiteHeader } from "@/components/site-header";
import { WEEKS } from "@/lib/content";
import { buildContentIndex } from "@/lib/content/summary";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "CCA-F Roadmap", template: "%s · CCA-F Roadmap" },
  description: "A 42-day study tracker for the Claude Certified Architect – Foundations exam",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#121210" },
  ],
};

const CONTENT_INDEX = buildContentIndex(WEEKS);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Sets data-theme before first paint; suppressHydrationWarning on <html> covers the attribute. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ProgressProvider index={CONTENT_INDEX}>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
            {children}
          </main>
        </ProgressProvider>
      </body>
    </html>
  );
}
