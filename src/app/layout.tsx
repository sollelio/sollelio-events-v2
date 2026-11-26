import type { Metadata, Viewport } from "next";
import { Geist, DM_Sans } from "next/font/google";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { getLocale, getMessages } from "@/messages";
import { ptPT } from "@/messages/pt-PT";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-auth" });

const productName = ptPT.common.productName;

export const metadata: Metadata = {
  title: { default: productName, template: `%s · ${productName}` },
};

export const viewport: Viewport = { viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-theme="dark"
      className={cn("dark font-sans", geist.variable, dmSans.variable)}
      suppressHydrationWarning
    >
      <body>
        <LocaleProvider locale={locale} messages={messages}>
          {children}
          <LanguageSwitcher locale={locale} />
        </LocaleProvider>
      </body>
    </html>
  );
}