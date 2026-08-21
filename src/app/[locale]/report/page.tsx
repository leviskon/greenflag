import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/report">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return {
    title: dict.reportPage.metaTitle,
    description: dict.reportPage.metaDescription,
    // Отчёт личный и живёт в браузере — в поиске ему делать нечего.
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({
  params,
}: PageProps<"/[locale]/report">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return <ReportView dict={dict} locale={locale} />;
}
