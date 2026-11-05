import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { appearancePrePaintScript } from "@/components/appearance/appearance";
import { AppearanceController } from "@/components/appearance/appearance-controller";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Sollelio Events",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before first paint by the inline script below.
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: appearancePrePaintScript }}
        />
      </head>
      <body>
        <AppearanceController />
        {children}
      </body>
    </html>
  );
}
