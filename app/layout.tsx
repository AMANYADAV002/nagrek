import type { Metadata, Viewport } from "next";
import { Caveat, Manrope, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { AmbientBackground } from "@/components/brand/ambient-background";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "600"] });

const description = "Never eat alone. Match with people nearby who are craving the same food, meet on live video, then share a table.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Nagrek — Talk ⇄ Eat", template: "%s · Nagrek" },
  description,
  applicationName: "Nagrek",
  keywords: ["food", "meet people", "foodies", "video call", "India", "social dining"],
  openGraph: { type: "website", siteName: "Nagrek", title: "Nagrek — Talk ⇄ Eat", description, locale: "en_IN", url: "/" },
  twitter: { card: "summary_large_image", title: "Nagrek — Talk ⇄ Eat", description },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${manrope.variable} ${spaceGrotesk.variable} ${caveat.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-brand px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <AmbientBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
