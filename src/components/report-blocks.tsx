import { REPORT_BLOCK_IDS } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Card, Section, SectionHead, Tag } from "./ui";

export function ReportBlocks({ dict }: { dict: Dictionary }) {
  const t = dict.report;

  return (
    <Section>
      <SectionHead
        tag={t.tag}
        title={
          <>
            <span className="text-accent">{t.titleAccent}</span> {t.titleTail}
          </>
        }
      />

      <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_BLOCK_IDS.map((id) => (
          <li key={id}>
            <Card className="gap-3">
              <Tag tone="ink" className="w-fit">
                {t.blocks[id].tag}
              </Tag>
              <h3 className="text-base font-extrabold sm:text-lg">
                {t.blocks[id].title}
              </h3>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}
