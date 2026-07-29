import Image from "next/image";
import { BATTLE_ROUNDS } from "@/lib/content";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Section, SectionHead, Tag } from "./ui";

export function Battle({ dict }: { dict: Dictionary }) {
  const t = dict.battle;

  return (
    <Section>
      <SectionHead
        tag={t.tag}
        tone="amber"
        title={
          <>
            {t.titleLead} <span className="text-accent">{t.titleAccent}</span>
          </>
        }
      />

      <div className="rounded-block shadow-block mx-auto mt-10 max-w-2xl bg-white p-5 sm:mt-12 sm:p-6">
        <div className="flex items-center justify-center gap-8">
          <Fighter src="/man.png" label={t.he} />
          <span className="font-display text-xs font-extrabold text-ink-muted uppercase">
            vs
          </span>
          <Fighter src="/woman.png" label={t.she} />
        </div>

        <ul className="mt-6 flex flex-col gap-2.5">
          {BATTLE_ROUNDS.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-dashed border-line pb-2.5 last:border-0 last:pb-0"
            >
              <span className="text-sm text-ink">{t.rounds[r.id]}</span>
              {r.winner === "locked" ? (
                <Tag tone="ink">{t.locked}</Tag>
              ) : (
                <Tag tone="pink">{r.winner === "he" ? t.he : t.she}</Tag>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Fighter({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Image
        src={src}
        alt={label}
        width={1024}
        height={1024}
        sizes="64px"
        className="size-14 rounded-2xl object-cover"
      />
      <span className="font-display text-sm font-extrabold">{label}</span>
    </div>
  );
}
