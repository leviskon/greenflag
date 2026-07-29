import { AI_MODELS } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Section, SectionHead, Tag } from "./ui";

export function AiCouncil({ dict }: { dict: Dictionary }) {
  const t = dict.ai;

  return (
    <Section>
      <SectionHead
        tag={t.tag}
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
        text={t.text}
      />

      <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5 sm:mt-12">
        {AI_MODELS.map((m) => (
          <li key={m}>
            <Tag tone="pink" className="text-xs normal-case">
              {m}
            </Tag>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-6 max-w-xs text-center text-sm text-ink-soft">
        {t.noteBefore}{" "}
        <span className="font-extrabold text-ink">{t.noteStrong}</span>
      </p>
    </Section>
  );
}
