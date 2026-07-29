import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Cta, Section } from "./ui";

export function FinalCta({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.finalCta;

  return (
    <Section id="start">
      <div className="rounded-block shadow-block-lg mx-auto flex max-w-2xl flex-col items-center gap-5 bg-pink-500 px-5 py-12 text-center sm:px-10 sm:py-14">
        <span className="rounded-full border border-dashed border-white/60 px-3 py-1 text-[11px] font-bold tracking-[0.06em] text-white uppercase">
          {t.badge}
        </span>
        <h2 className="text-[25px] leading-[1.15] font-extrabold text-white sm:text-3xl lg:text-[34px]">
          {t.title}
        </h2>
        <Cta
          href={`/${locale}/test`}
          size="lg"
          variant="invert"
          className="w-full sm:w-auto"
        >
          {dict.cta.start}
        </Cta>
      </div>
    </Section>
  );
}
