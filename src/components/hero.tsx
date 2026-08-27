import Image from "next/image";
import { COMPATIBILITY, FLAG_STATS, HERO_FACTS } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Cta, Tag } from "./ui";

export function Hero({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.hero;
  const [she, he] = FLAG_STATS;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:py-18">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
          <Tag tone="green">{t.tag}</Tag>

          <h1 className="text-[32px] leading-[1.12] font-extrabold sm:text-[42px] lg:text-[46px]">
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </h1>

          <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft sm:text-base">
            {t.text}
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Cta href={`/${locale}/test`} size="lg" className="w-full sm:w-auto">
              {dict.cta.start}
            </Cta>
            <Cta
              href="#report"
              size="lg"
              variant="soft"
              className="w-full sm:w-auto"
            >
              {dict.cta.whatInside}
            </Cta>
          </div>

          <dl className="grid w-full max-w-sm grid-cols-3 gap-4 text-center lg:max-w-none lg:text-left">
            {HERO_FACTS.map((key) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="font-display text-lg font-extrabold text-pink-600 sm:text-xl">
                  {t.facts[key].value}
                </dt>
                <dd className="text-xs text-ink-muted">{t.facts[key].label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-block shadow-block-lg mx-auto w-full max-w-sm bg-white p-5 sm:max-w-md sm:p-6 lg:max-w-none">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-sm font-extrabold">
              {t.card.title}
            </span>
            <Tag tone="ink">{t.card.ready}</Tag>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
            <Portrait src="/woman.png" label={t.card.she} />
            <Portrait src="/man.png" label={t.card.he} />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink-soft">
                {t.card.compatibility}
              </span>
              <span className="font-display text-2xl leading-none font-extrabold text-accent">
                {COMPATIBILITY}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pink-100">
              <div
                className="h-full rounded-full bg-pink-500"
                style={{ width: `${COMPATIBILITY}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Tag tone="green">
              {she.green} {t.card.greenFlags}
            </Tag>
            <Tag tone="red">
              {he.red} {t.card.redFlags}
            </Tag>
          </div>
        </div>
      </div>
    </section>
  );
}

function Portrait({ src, label }: { src: string; label: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="aspect-square overflow-hidden rounded-2xl bg-pink-50">
        {/* Первый экран, поэтому загружаем сразу. preload не ставим: портретов
            два, и какой из них окажется LCP — зависит от ширины экрана.
            priority в Next 16 объявлен устаревшим. */}
        <Image
          src={src}
          alt={label}
          width={1024}
          height={1024}
          loading="eager"
          sizes="(max-width: 640px) 45vw, 220px"
          className="size-full object-cover"
        />
      </div>
      <figcaption className="text-center text-xs font-bold text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}
