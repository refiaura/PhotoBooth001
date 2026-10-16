import type { Metadata, Viewport } from "next";
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import { id } from "@/i18n/id";
import "./globals.css";

// Variable font: semua ketebalan tersedia. Jangan isi `weight: [...]`, karena next/font
// di Turbopack (16.4) gagal build dengan "queries have exactly one entry".
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: id.appName,
  description: id.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1530" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fredoka.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
