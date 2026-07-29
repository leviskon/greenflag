import { notFound } from "next/navigation";
import { AiCouncil } from "@/components/ai-council";
import { Anatomy } from "@/components/anatomy";
import { Battle } from "@/components/battle";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { MobileCta } from "@/components/mobile-cta";
import { ReportBlocks } from "@/components/report-blocks";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Ticker } from "@/components/ticker";
import { Trials } from "@/components/trials";
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
        <Anatomy dict={dict} />
        <ReportBlocks dict={dict} />
        <Battle dict={dict} />
        <Trials dict={dict} />
        <AiCouncil dict={dict} />
        <Faq dict={dict} />
        <FinalCta dict={dict} locale={locale} />
      </main>
      <SiteFooter dict={dict} locale={locale} />
      <MobileCta dict={dict} locale={locale} />
    </>
  );
}
