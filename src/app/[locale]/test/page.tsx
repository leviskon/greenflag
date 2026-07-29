import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Cta, Tag } from "@/components/ui";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/test">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return {
    title: dict.testPage.metaTitle,
    description: dict.testPage.metaDescription,
  };
}

/** Заглушка: сюда позже встанет сам тест. */
export default async function TestPage({ params }: PageProps<"/[locale]/test">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const t = dict.testPage;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6">
      <div className="rounded-block shadow-block-lg mx-auto flex w-full max-w-md flex-col items-center gap-4 bg-white p-6 text-center sm:p-10">
        <Tag>{t.tag}</Tag>
        <h1 className="text-[25px] leading-[1.15] font-extrabold sm:text-3xl">
          {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
        </h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t.text}</p>
        <Cta href={`/${locale}`}>{dict.cta.toHome}</Cta>
        <LocaleSwitcher
          locale={locale}
          path="/test"
          label={dict.switcher.label}
        />
      </div>
    </main>
  );
}
