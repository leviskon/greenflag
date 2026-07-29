import { TRIALS } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Card, Section, SectionHead, Tag } from "./ui";

export function Trials({ dict }: { dict: Dictionary }) {
  const t = dict.trials;

  return (
    <Section id="trials">
      <SectionHead
        tag={t.tag}
        tone="green"
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
        text={t.text}
      />

      <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
        {TRIALS.map((trial) => (
          <li key={trial.id}>
            <Card className="justify-between gap-4">
              <h3 className="text-base font-extrabold">{t.items[trial.id]}</h3>
              <Tag
                tone={trial.state === "open" ? "green" : "ink"}
                className="w-fit"
              >
                {trial.state === "open" ? t.verdicts.open : t.verdicts.locked}
              </Tag>
            </Card>
          </li>
        ))}

        <li>
          <Card className="items-center justify-center text-center">
            <span className="font-display text-2xl font-extrabold text-accent">
              {t.more.value}
            </span>
            <p className="mt-1 text-sm text-ink-soft">{t.more.label}</p>
          </Card>
        </li>
      </ul>
    </Section>
  );
}
