import { notFound } from "next/navigation";
import { Faq } from "@/components/faq";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MobileCta } from "@/components/mobile-cta";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Ticker } from "@/components/ticker";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <>
      <SiteHeader dict={dict} locale={locale} />
      <main>
        <Hero dict={dict} locale={locale} />
        <Ticker dict={dict} />
        <HowItWorks dict={dict} />
        <Faq dict={dict} />
      </main>
      <SiteFooter dict={dict} locale={locale} />
      <MobileCta label={dict.cta.takeTogether} locale={locale} />
    </>
  );
}
