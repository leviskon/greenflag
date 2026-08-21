"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import {
  buildReport,
  formatDate,
  formatSince,
  type BlitzRow,
  type ChoiceRow,
  type Quote,
  type ScaleRow,
} from "@/lib/report";
import {
  parseState,
  readRawState,
  readServerState,
  subscribeToState,
} from "@/lib/storage";
import { Bar, Donut, LockedBlock, ReportBlock, Stat, TONE_TEXT } from "./report-ui";

type VerdictQuestion = Extract<
  Dictionary["quiz"]["questions"][number],
  { type: "verdict" }
>;

/**
 * Признак «мы уже в браузере»: на сервере и при гидрации false, дальше true.
 * Через внешний источник, а не через эффект: до гидрации localStorage читать
 * нельзя, а пустое состояние показывать рано — данные могут быть.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** Какие блоки показываем закрытыми: тексты берём из словаря лендинга. */
const LOCKED_IDS = [
  "breakup",
  "forecast",
  "cheating",
  "strengths",
  "dates",
  "fun",
] as const;

export function ReportView({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.reportPage;
  const who = dict.anatomy.who;

  // Снимок localStorage: на сервере пустой, после гидрации — настоящий.
  const raw = useSyncExternalStore(
    subscribeToState,
    readRawState,
    readServerState,
  );
  const stored = useMemo(() => parseState(raw), [raw]);

  const ready = useSyncExternalStore(neverChanges, onClient, onServer);
  const [copied, setCopied] = useState(false);

  const archetypes = t.archetype.items.length;
  const report = useMemo(
    () => (stored ? buildReport(stored, dict.quiz, archetypes) : null),
    [stored, dict.quiz, archetypes],
  );

  // Подписи «норм / стрем» живут в самом вопросе, поэтому достаём их оттуда.
  const verdictQuestion = dict.quiz.questions.find(
    (question): question is VerdictQuestion =>
      "type" in question && question.type === "verdict",
  );
  const okLabel = verdictQuestion?.okLabel ?? "";
  const badLabel = verdictQuestion?.badLabel ?? "";

  async function handleShare() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: t.metaTitle, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Пользователь закрыл системное окно — ничего делать не нужно.
    }
  }

  function openUnlock() {
    document
      .getElementById("unlock")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const header = (
    <header className="no-print sticky top-0 z-30 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="font-display text-base font-extrabold tracking-tight"
        >
          Green<span className="text-pink-500">Flag</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="shadow-block rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-ink transition-colors hover:text-pink-600"
          >
            {copied ? t.actions.copied : t.actions.share}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="shadow-pill rounded-full bg-pink-500 px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-pink-600"
          >
            {t.actions.pdf}
          </button>
        </div>
      </div>
    </header>
  );

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        {header}
        <p className="m-auto text-sm text-ink-soft">{t.loading}</p>
      </div>
    );
  }

  if (!stored || !report || !report.hasData) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        {header}
        <div className="m-auto w-full max-w-sm px-4 text-center">
          <span aria-hidden className="text-3xl">
            📄
          </span>
          <h1 className="mt-3 text-xl font-extrabold">{t.empty.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {t.empty.text}
          </p>
          <Link
            href={`/${locale}/test`}
            className="shadow-pill mt-5 inline-flex rounded-full bg-pink-500 px-6 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-pink-600"
          >
            {t.empty.cta}
          </Link>
        </div>
      </div>
    );
  }

  const archetype = t.archetype.items[report.archetype];

  return (
    <div className="min-h-dvh bg-canvas">
      {header}

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-10 sm:px-6">
        {/* Шапка отчёта */}
        <section className="rounded-block shadow-block avoid-break relative overflow-hidden bg-white p-4 print:shadow-none sm:p-6">
          <Image
            src="/couple.png"
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            sizes="(max-width: 640px) 40vw, 200px"
            className="pointer-events-none absolute -top-2 right-0 w-28 max-w-none opacity-90 select-none sm:w-40"
          />

          <p className="text-[11px] font-extrabold tracking-[0.06em] text-pink-600 uppercase">
            {t.hero.tag}
          </p>
          <h1 className="mt-1 max-w-[60%] text-[24px] leading-[1.05] font-extrabold sm:text-[30px]">
            {t.hero.titleLead}{" "}
            <span className="text-accent">{t.hero.titleAccent}</span>
          </h1>
          <p className="mt-2 max-w-[60%] text-sm font-bold text-ink-soft">
            {report.names.she} + {report.names.he}
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-canvas p-2.5">
              <dt className="text-[10px] font-bold text-ink-muted">
                {t.hero.sinceLabel}
              </dt>
              <dd className="font-display mt-0.5 text-sm font-extrabold">
                {formatSince(report.since)}
              </dd>
            </div>
            <div className="rounded-2xl bg-canvas p-2.5">
              <dt className="text-[10px] font-bold text-ink-muted">
                {t.hero.answeredLabel}
              </dt>
              <dd className="font-display mt-0.5 text-sm font-extrabold">
                {report.answered} / {report.total}
              </dd>
            </div>
            <div className="rounded-2xl bg-canvas p-2.5">
              <dt className="text-[10px] font-bold text-ink-muted">
                {t.hero.dateLabel}
              </dt>
              <dd className="font-display mt-0.5 text-sm font-extrabold">
                {formatDate(stored.updatedAt)}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[10px] leading-snug text-ink-muted sm:text-[11px]">
            {t.demo}
          </p>
        </section>

        {/* 1. Совместимость */}
        <ReportBlock n={1} title={t.compat.title} note={t.compat.note}>
          <div className="flex items-end justify-between gap-3">
            <p
              className={cn(
                "font-display text-4xl leading-none font-extrabold",
                TONE_TEXT[report.compatTone],
              )}
            >
              {report.compatibility}%
            </p>
            <p className="text-right text-xs font-bold text-ink-soft">
              {t.compat.levels[report.compatTone]}
            </p>
          </div>
          <div className="mt-3">
            <Bar value={report.compatibility} tone={report.compatTone} />
          </div>
        </ReportBlock>

        {/* 2. Архетип */}
        <ReportBlock n={2} title={t.archetype.title}>
          <p className="font-display text-xl font-extrabold text-accent uppercase sm:text-2xl">
            {archetype.name}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {archetype.text}
          </p>
        </ReportBlock>

        {/* 3. Анатомия */}
        <ReportBlock n={3} title={t.anatomy.title} note={t.anatomy.note}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {report.metrics.map((metric) => (
              <Donut
                key={metric.id}
                value={metric.value}
                tone={metric.tone}
                label={dict.anatomy.metrics[metric.id]}
              />
            ))}
          </div>
        </ReportBlock>

        {/* 4. Флагометр */}
        <ReportBlock n={4} title={t.flags.title} note={t.flags.note}>
          {report.flags.total === 0 ? (
            <p className="text-xs text-ink-muted">{t.blitz.empty}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                value={report.flags.agree}
                label={`${dict.anatomy.green} · ${t.flags.agree}`}
                tone="good"
              />
              <Stat
                value={report.flags.clash}
                label={`${dict.anatomy.red} · ${t.flags.clash}`}
                tone="bad"
              />
              <Stat
                value={report.flags.strictShe}
                label={t.flags.strictShe}
                tone="ink"
              />
              <Stat
                value={report.flags.strictHe}
                label={t.flags.strictHe}
                tone="ink"
              />
            </div>
          )}
        </ReportBlock>

        {/* 5. Шкала «или — или» */}
        <ReportBlock n={5} title={t.scale.title}>
          {report.scale.rows.length === 0 ? (
            <p className="text-xs text-ink-muted">{t.scale.empty}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <Legend she={who.she} he={who.he} />

              <ScaleGroup
                title={t.scale.matchTitle}
                tone="good"
                rows={report.scale.matches}
              />
              <ScaleGroup
                title={t.scale.clashTitle}
                tone="bad"
                rows={report.scale.clashes}
              />
            </div>
          )}
        </ReportBlock>

        {/* 6. Блиц-опрос */}
        <ReportBlock n={6} title={t.blitz.title}>
          {report.blitz.length === 0 ? (
            <p className="text-xs text-ink-muted">{t.blitz.empty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {report.blitz.map((row) => (
                <BlitzItem
                  key={row.index}
                  row={row}
                  she={who.she}
                  he={who.he}
                  okLabel={okLabel}
                  badLabel={badLabel}
                />
              ))}
            </ul>
          )}
        </ReportBlock>

        {/* 7. Выбранные варианты */}
        <ReportBlock n={7} title={t.choices.styleTitle}>
          <ChoiceList
            rows={report.style}
            both={t.choices.both}
            she={who.she}
            he={who.he}
            empty={t.choices.empty}
          />
        </ReportBlock>

        <ReportBlock n={8} title={t.choices.goalsTitle}>
          <ChoiceList
            rows={report.goals}
            both={t.choices.both}
            she={who.she}
            he={who.he}
            empty={t.choices.empty}
          />
        </ReportBlock>

        {/* 9. Цитаты */}
        <ReportBlock n={9} title={t.quotes.title} note={t.quotes.note}>
          {report.quotes.length === 0 ? (
            <p className="text-xs text-ink-muted">{t.choices.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {report.quotes.map((quote) => (
                <QuoteItem
                  key={quote.id}
                  quote={quote}
                  she={who.she}
                  he={who.he}
                  empty={t.quotes.empty}
                />
              ))}
            </ul>
          )}
        </ReportBlock>

        {/* 10. Риски */}
        <ReportBlock n={10} title={t.risks.title}>
          <div className="grid grid-cols-2 gap-3">
            <Donut
              value={report.risks.fight}
              tone={report.risks.fight >= 65 ? "bad" : report.risks.fight >= 40 ? "mid" : "good"}
              label={dict.anatomy.risks.fight}
              size={96}
            />
            <Donut
              value={report.risks.breakup}
              tone={report.risks.breakup >= 65 ? "bad" : report.risks.breakup >= 40 ? "mid" : "good"}
              label={dict.anatomy.risks.breakup}
              size={96}
            />
          </div>
        </ReportBlock>

        {/* Закрытые блоки */}
        <h2 className="mt-4 text-center text-lg font-extrabold sm:text-xl">
          {t.locked.title}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOCKED_IDS.map((id) => (
            <LockedBlock
              key={id}
              tag={t.locked.tag}
              title={dict.report.blocks[id].title}
              placeholder={t.locked.placeholder}
              cta={t.locked.cta}
              onOpen={openUnlock}
            />
          ))}
        </div>

        {/* Финал */}
        <section
          id="unlock"
          className="rounded-block shadow-block avoid-break scroll-mt-16 bg-white p-5 text-center print:shadow-none"
        >
          <h2 className="text-lg font-extrabold sm:text-xl">
            {t.unlock.title}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
            {t.unlock.text}
          </p>

          <div className="no-print mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}`}
              className="shadow-pill rounded-full bg-pink-500 px-6 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-pink-600"
            >
              {t.unlock.toHome}
            </Link>
            <Link
              href={`/${locale}/test`}
              className="shadow-block rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-ink transition-colors hover:text-pink-600"
            >
              {t.unlock.toTest}
            </Link>
          </div>
        </section>

        <p className="mt-2 text-center text-[10px] leading-snug text-ink-muted sm:text-[11px]">
          {t.disclaimer}
        </p>
      </main>
    </div>
  );
}

/** Кто есть кто на шкале: розовая точка — она, тёмная — он. */
function Legend({ she, he }: { she: string; he: string }) {
  return (
    <div className="flex items-center gap-4 text-[11px] font-bold text-ink-soft">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full bg-pink-500" />
        {she}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full bg-ink-soft" />
        {he}
      </span>
    </div>
  );
}

function ScaleGroup({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "good" | "bad";
  rows: ScaleRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p
        className={cn(
          "text-[11px] font-extrabold tracking-[0.06em] uppercase",
          tone === "good" ? "text-flag-green" : "text-flag-red",
        )}
      >
        {title}
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.index} className="rounded-2xl bg-canvas p-3">
            <div className="flex items-start justify-between gap-2 text-[11px] leading-tight font-bold">
              <span className="min-w-0 flex-1">{row.left}</span>
              <span className="min-w-0 flex-1 text-right">{row.right}</span>
            </div>

            {/* Позиции обоих на одной дорожке: видно, куда каждый склонился */}
            <div className="relative mx-2 mt-3 h-4">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-pink-100" />
              <Marker value={row.she} className="bg-pink-500" />
              <Marker value={row.he} className="bg-ink-soft" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Точка на дорожке: 1 — слева, 7 — справа. */
function Marker({ value, className }: { value: number; className: string }) {
  return (
    <span
      aria-hidden
      style={{ left: `${((value - 1) / 6) * 100}%` }}
      className={cn(
        "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
        className,
      )}
    />
  );
}

function BlitzItem({
  row,
  she,
  he,
  okLabel,
  badLabel,
}: {
  row: BlitzRow;
  she: string;
  he: string;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-canvas p-2.5">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          row.agree ? "bg-flag-green" : "bg-flag-red",
        )}
      />
      <p className="min-w-0 flex-1 text-[12px] leading-tight font-bold">
        {row.statement}
      </p>
      <VerdictBadge who={she} value={row.she} ok={okLabel} bad={badLabel} />
      <VerdictBadge who={he} value={row.he} ok={okLabel} bad={badLabel} />
    </li>
  );
}

function VerdictBadge({
  who,
  value,
  ok,
  bad,
}: {
  who: string;
  value: "ok" | "bad";
  ok: string;
  bad: string;
}) {
  return (
    <span
      title={who}
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
        value === "ok"
          ? "bg-flag-green/10 text-flag-green"
          : "bg-flag-red/10 text-flag-red",
      )}
    >
      {value === "ok" ? ok : bad}
    </span>
  );
}

function ChoiceList({
  rows,
  both,
  she,
  he,
  empty,
}: {
  rows: ChoiceRow[];
  both: string;
  she: string;
  he: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-ink-muted">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const label = row.she && row.he ? both : row.she ? she : he;
        const tone =
          row.she && row.he
            ? "bg-pink-500 text-white"
            : "bg-pink-50 text-pink-600";

        return (
          <li
            key={row.option}
            className="flex items-center gap-2 rounded-2xl bg-canvas p-2.5"
          >
            <p className="min-w-0 flex-1 text-[12px] leading-tight font-bold">
              {row.option}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                tone,
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function QuoteItem({
  quote,
  she,
  he,
  empty,
}: {
  quote: Quote;
  she: string;
  he: string;
  empty: string;
}) {
  return (
    <li className="rounded-2xl bg-canvas p-3">
      <p className="text-[11px] leading-snug font-bold text-ink-muted">
        {quote.question}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <QuoteSide who={she} text={quote.she || empty} tone="she" />
        <QuoteSide who={he} text={quote.he || empty} tone="he" />
      </div>
    </li>
  );
}

function QuoteSide({
  who,
  text,
  tone,
}: {
  who: string;
  text: string;
  tone: "she" | "he";
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-2.5",
        tone === "she" ? "bg-pink-50" : "bg-white",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-extrabold tracking-[0.06em] uppercase",
          tone === "she" ? "text-pink-600" : "text-ink-soft",
        )}
      >
        {who}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-ink">{text}</p>
    </div>
  );
}
