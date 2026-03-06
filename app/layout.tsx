import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "consilium — multi-model deliberation",
  description:
    "Five frontier LLMs debate your question. One judge synthesizes. Free with your OpenRouter key.",
  metadataBase: new URL("https://consilium.sh"),
  openGraph: {
    title: "consilium — multi-model deliberation",
    description:
      "Five frontier LLMs debate your question. One judge synthesizes.",
    url: "https://consilium.sh",
    siteName: "consilium",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "consilium — multi-model deliberation",
    description:
      "Five frontier LLMs debate your question. One judge synthesizes.",
  },
  keywords: ["AI", "multi-model", "deliberation", "debate", "OpenRouter", "LLM"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="fixed top-0 left-0 right-0 h-12 border-b bg-background/80 backdrop-blur-sm z-50 flex items-center px-4">
          <a href="/" className="font-semibold text-sm tracking-tight">consilium</a>
          <div className="ml-auto flex items-center gap-2">
            <AuthButton />
            <ThemeToggle />
          </div>
        </header>
        <div className="pt-12">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
