import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "lenis/dist/lenis.css";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://op8n.app'),
  title: "Op8n — Describe any automation in plain English → get importable n8n JSON",
  description: "Op8n is an AI-powered generator that transforms plain English descriptions into valid, importable n8n workflow JSON in seconds.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png" },
    ],
  },
  openGraph: {
    title: "Op8n — AI n8n Workflow Generator",
    description: "Describe any automation in plain English → get importable n8n JSON in seconds.",
    url: "https://op8n.app",
    siteName: "Op8n",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 800,
        alt: "Op8n Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Op8n — AI n8n Workflow Generator",
    description: "Describe any automation in plain English → get importable n8n JSON in seconds.",
    images: ["/logo.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="h-dvh max-h-dvh overflow-hidden flex flex-col bg-[#070709] text-zinc-100 selection:bg-[#01B6FE]/30 selection:text-white">
        <SmoothScroll>
          {children}
        </SmoothScroll>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #2e2e35',
              color: '#f4f4f5',
            },
          }}
        />
      </body>
    </html>
  );
}
