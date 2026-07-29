import type { Dictionary } from "@/lib/i18n/dictionary";
import { Section, SectionHead } from "./ui";

export function Faq({ dict }: { dict: Dictionary }) {
  const t = dict.faq;

  return (
    <Section id="faq">
      <SectionHead
        tag={t.tag}
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
      />

      <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:mt-12">
        {t.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-block shadow-block bg-white px-5 py-4 sm:px-6"
          >
            <summary className="flex items-center justify-between gap-4 text-[15px] font-extrabold">
              {item.q}
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-pink-50 text-base leading-none font-bold text-pink-600 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
