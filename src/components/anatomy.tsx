import { ANATOMY_METRICS, FLAG_STATS, RISKS } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Card, Section, SectionHead, Tag } from "./ui";

const TONES = {
  good: "bg-flag-green",
  mid: "bg-pink-400",
  bad: "bg-flag-red",
} as const;

export function Anatomy({ dict }: { dict: Dictionary }) {
  const t = dict.anatomy;

  return (
    <Section id="report">
      <SectionHead
        tag={t.tag}
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
        text={t.text}
      />

      <div className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-extrabold sm:text-lg">
            {t.profileTitle}
          </h3>
          <dl className="mt-5 flex flex-col gap-4">
            {ANATOMY_METRICS.map((m) => (
              <div key={m.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-ink-soft">{t.metrics[m.id]}</dt>
                  <dd className="font-display text-sm font-extrabold">
                    {m.value}%
                  </dd>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-pink-100">
                  <div
                    className={`h-full rounded-full ${TONES[m.tone]}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </Card>

        <div className="grid gap-4">
          <Card>
            <h3 className="text-base font-extrabold sm:text-lg">
              {t.flagmeterTitle}
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {FLAG_STATS.map((f) => (
                <div key={f.id} className="flex flex-col items-center gap-2">
                  <span className="font-display text-sm font-extrabold">
                    {t.who[f.id]}
                  </span>
                  <Tag tone="green">
                    {f.green} {t.green}
                  </Tag>
                  <Tag tone="red">
                    {f.red} {t.red}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-extrabold sm:text-lg">
              {t.riskTitle}
            </h3>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              {RISKS.map((r) => (
                <div key={r.id}>
                  <dt className="font-display text-2xl font-extrabold text-pink-600">
                    {r.value}
                  </dt>
                  <dd className="mt-1 text-xs text-ink-muted">
                    {t.risks[r.id]}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {t.riskNote}
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
