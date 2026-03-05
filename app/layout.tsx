import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";

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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <AuthButton />
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
