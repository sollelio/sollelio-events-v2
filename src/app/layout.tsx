import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { appearancePrePaintScript } from "@/components/appearance/appearance";
import { AppearanceController } from "@/components/appearance/appearance-controller";
import { cn } from "@/lib/utils";
import { getMessages, LOCALE } from "@/messages";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const productName = getMessages().common.productName;

export const metadata: Metadata = {
  title: { default: productName, template: `%s · ${productName}` },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before first paint by the inline script below.
    <html
      lang={LOCALE}
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
