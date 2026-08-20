import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { TestFlow } from "@/components/test/test-flow";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/test">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return {
    title: dict.testForm.metaTitle,
    description: dict.testForm.metaDescription,
  };
}

export default async function TestPage({
  params,
}: PageProps<"/[locale]/test">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const t = dict.testForm;

  return (
    // Страница ровно во весь экран и без своего скролла: шаги теста сами
    // распределяют высоту. Прокрутку включает только тот шаг, которому она
    // нужна, — иначе на экране появляется вторая, ничего не делающая полоса.
    <div className="flex h-dvh flex-col overflow-hidden">
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden px-4 sm:px-6">
        <TestFlow
          formTexts={t}
          quizTexts={dict.quiz}
          switcherLabel={dict.switcher.label}
          locale={locale}
          header={
            // Картинка лежит на заднем плане и заходит под текст.
            <div className="relative isolate">
              {/* Без priority: картинка декоративная, а с высоким приоритетом
                  она отбирает канал у скриптов и на телефоне форма долго
                  остаётся «мёртвой». */}
              <Image
                src="/couple.png"
                alt=""
                aria-hidden
                width={1024}
                height={1024}
                sizes="(max-width: 640px) 42vw, 220px"
                className="pointer-events-none absolute top-0 right-0 -z-10 w-32 max-w-none opacity-90 select-none sm:-top-3 sm:w-44 lg:-top-14 lg:w-52"
              />

              <h1 className="max-w-[62%] text-[26px] leading-[1.08] font-extrabold sm:max-w-[64%] sm:text-[28px] lg:text-[32px]">
                {t.titleLead} <span className="text-accent">{t.titleAccent}</span> {t.titleTail}
              </h1>

              <p className="mt-2 max-w-[92%] text-[13px] leading-snug text-ink-soft sm:max-w-[64%] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          }
        />
      </main>
    </div>
  );
}
