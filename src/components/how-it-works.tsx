import type { Dictionary } from "@/lib/i18n/dictionary";
import { Card, Section, SectionHead, Tag } from "./ui";

export function HowItWorks({ dict }: { dict: Dictionary }) {
  const t = dict.steps;

  return (
    <Section id="how">
      <SectionHead
        tag={t.tag}
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
      />

      <ol className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-3">
        {t.items.map((step, i) => (
          <li key={step.title}>
            <Card>
              <span className="font-display text-sm font-extrabold text-pink-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-base font-extrabold sm:text-lg">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.text}
              </p>
            </Card>
          </li>
        ))}
      </ol>

      <p className="mt-8 flex justify-center">
        <Tag tone="green">{t.privateNote}</Tag>
      </p>
    </Section>
  );
}
