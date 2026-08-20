import type { Metadata, Viewport } from "next";
import { Geologica, Golos_Text } from "next/font/google";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import "../globals.css";

// Шрифты обязаны содержать кыргызские Ң (U+04A2), Ү (U+04AE), Ө (U+04E8):
// они лежат в сабсете cyrillic-ext, поэтому его тоже запрашиваем.
// Manrope и Unbounded здесь не подходят — этих глифов в их файлах нет.
const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["cyrillic", "cyrillic-ext", "latin"],
  display: "swap",
});

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["cyrillic", "cyrillic-ext", "latin"],
  display: "swap",
  weight: ["600", "700", "800"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      type: "website",
      locale: locale === "ru" ? "ru_RU" : "ky_KG",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#fff6fa",
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${golos.variable} ${geologica.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
