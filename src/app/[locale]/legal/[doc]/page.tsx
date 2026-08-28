import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { formatLegalDate, isLegalDoc, LEGAL, LEGAL_DOCS } from "@/lib/legal";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    LEGAL_DOCS.map((doc) => ({ locale, doc })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isLegalDoc(doc)) notFound();

  const dict = await getDictionary(locale);
  const document = dict.legal.docs[doc];

  return {
    title: `${document.title} — GreenFlag`,
    description: document.subtitle,
    alternates: {
      canonical: `/${locale}/legal/${doc}`,
      languages: Object.fromEntries(
        locales.map((item) => [item, `/${item}/legal/${doc}`]),
      ),
    },
  };
}

export default async function LegalPage({
  params,
}: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isLegalDoc(doc)) notFound();

  const dict = await getDictionary(locale);
  const t = dict.legal;
  const document = t.docs[doc];

  return (
    <>
      <SiteHeader dict={dict} locale={locale} />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[26px] leading-[1.15] font-extrabold sm:text-3xl">
          {document.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {document.subtitle}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {t.updated.replace("{date}", formatLegalDate(LEGAL.updated))}
        </p>

        <div className="mt-8 flex flex-col gap-7">
          {document.sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-base font-extrabold sm:text-lg">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {section.items.map((item) => {
                  // Подстановку делаем до key, иначе шаблон {provider} уезжает
                  // в разметку как ключ элемента.
                  const text = item.replace("{provider}", LEGAL.aiProvider);

                  return (
                    <p
                      key={text}
                      className="text-[13px] leading-relaxed text-ink-soft sm:text-sm"
                    >
                      {text}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      <SiteFooter dict={dict} locale={locale} />
    </>
  );
}
