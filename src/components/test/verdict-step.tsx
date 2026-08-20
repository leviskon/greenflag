"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/ru";
import type { AnswerPair, Participant } from "@/lib/storage";
import { StepFooter } from "./step-footer";

type Texts = Dictionary["quiz"];
type Question = Extract<Texts["questions"][number], { type: "verdict" }>;

/** Вердикт по одному утверждению: null — участник ещё не ответил. */
type Verdict = "ok" | "bad" | null;
type Verdicts = Verdict[];

/**
 * В localStorage ответ лежит строкой «ok,bad,ok,…» — по одному вердикту на
 * утверждение в порядке списка. Пустой слот означает «нет ответа».
 */
function parseVerdicts(value: string, length: number): Verdicts {
  const parts = value ? value.split(",") : [];

  return Array.from({ length }, (_, i) => {
    const token = parts[i]?.trim();
    return token === "ok" || token === "bad" ? token : null;
  });
}

function serialize(verdicts: Verdicts): string {
  // Пустой ответ пишем пустой строкой, а не «,,,»: так он остаётся «непройденным».
  if (verdicts.every((verdict) => verdict === null)) return "";

  return verdicts.map((verdict) => verdict ?? "").join(",");
}

/**
 * Блиц-опрос: на каждое утверждение оба участника отвечают «норм» или «стрем».
 */
export function VerdictStep({
  texts,
  question,
  index,
  total,
  initial,
  backLabel,
  onSubmit,
  onBack,
}: {
  texts: Texts;
  question: Question;
  index: number;
  total: number;
  initial: AnswerPair;
  backLabel: string;
  onSubmit: (answer: AnswerPair) => void;
  onBack: (answer: AnswerPair) => void;
}) {
  const count = question.statements.length;

  const [verdicts, setVerdicts] = useState<Record<Participant, Verdicts>>(
    () => ({
      she: parseVerdicts(initial.she, count),
      he: parseVerdicts(initial.he, count),
    }),
  );

  function choose(
    side: Participant,
    statementIndex: number,
    verdict: Exclude<Verdict, null>,
  ) {
    setVerdicts((prev) => {
      const next = [...prev[side]];
      next[statementIndex] = verdict;

      return { ...prev, [side]: next };
    });
  }

  function collect(): AnswerPair {
    return { she: serialize(verdicts.she), he: serialize(verdicts.he) };
  }

  const filled = question.statements.filter(
    (_, i) => verdicts.she[i] !== null && verdicts.he[i] !== null,
  ).length;
  const ready = filled === count;
  const isLast = index + 1 === total;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onBack(collect())}
          className="shadow-block rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-ink transition-colors hover:text-pink-600"
        >
          ← {backLabel}
        </button>
        <span className="text-xs font-bold text-ink-muted">
          {texts.progress
            .replace("{current}", String(index + 1))
            .replace("{total}", String(total))}
        </span>
      </div>

      <div
        className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-pink-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div
          className="h-full rounded-full bg-pink-500 transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="shrink-0 text-center">
        <h1 className="text-base leading-snug font-extrabold sm:text-xl">
          {question.text}
          <br />«
          <span className="text-flag-green uppercase">{question.okLabel}</span>{" "}
          {question.orLabel}{" "}
          <span className="text-flag-red uppercase">{question.badLabel}</span>»
        </h1>
        <p
          aria-live="polite"
          className={cn(
            "mt-1 text-[11px] font-bold sm:text-xs",
            ready ? "text-flag-green" : "text-pink-600",
          )}
        >
          {texts.filledCounter
            .replace("{done}", String(filled))
            .replace("{total}", String(count))}
        </p>
      </div>

      {/* Список занимает всё свободное место и прокручивается внутри себя.
          Высоту в пикселях задавать нельзя: на невысоком экране шаг перестаёт
          влезать и появляется скролл всей страницы. */}
      <ul className="flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-0.5 py-0.5 sm:gap-3">
        {question.statements.map((statement, statementIndex) => (
          <li
            key={statementIndex}
            className="rounded-block shadow-block shrink-0 bg-white p-2.5 sm:p-3"
          >
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full bg-pink-500 text-[10px] font-extrabold text-white sm:size-6 sm:text-[11px]"
              >
                {statementIndex + 1}
              </span>
              <p className="min-w-0 flex-1 text-[12px] leading-tight font-bold sm:text-sm">
                {statement}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:gap-2.5">
              <VerdictColumn
                side="she"
                title={texts.turnShe}
                avatar="/woman.png"
                name={`${question.id}-she-${statementIndex}`}
                statement={statement}
                okLabel={question.okLabel}
                badLabel={question.badLabel}
                value={verdicts.she[statementIndex]}
                onChoose={(verdict) => choose("she", statementIndex, verdict)}
              />
              <VerdictColumn
                side="he"
                title={texts.turnHe}
                avatar="/man.png"
                name={`${question.id}-he-${statementIndex}`}
                statement={statement}
                okLabel={question.okLabel}
                badLabel={question.badLabel}
                value={verdicts.he[statementIndex]}
                onChoose={(verdict) => choose("he", statementIndex, verdict)}
              />
            </div>
          </li>
        ))}
      </ul>

      <StepFooter
        label={isLast ? texts.finish : texts.next}
        hint={texts.hint}
        disabled={!ready}
        onClick={() => onSubmit(collect())}
      />
    </div>
  );
}

/** Колонка одного участника: аватар и две кнопки вердикта. */
function VerdictColumn({
  side,
  title,
  avatar,
  name,
  statement,
  okLabel,
  badLabel,
  value,
  onChoose,
}: {
  side: Participant;
  title: string;
  avatar: string;
  /** Уникальное имя группы: связывает «норм» и «стрем» одного утверждения. */
  name: string;
  statement: string;
  okLabel: string;
  badLabel: string;
  value: Verdict;
  onChoose: (verdict: Exclude<Verdict, null>) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${title}: ${statement}`}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-2xl px-1.5 py-1",
          side === "she" ? "bg-pink-50" : "bg-canvas",
        )}
      >
        <Image
          src={avatar}
          alt=""
          aria-hidden
          width={1024}
          height={1024}
          sizes="40px"
          className="size-8 shrink-0 rounded-full object-cover sm:size-10"
        />
        <span
          className={cn(
            "min-w-0 text-[10px] leading-tight font-extrabold sm:text-xs",
            side === "she" ? "text-pink-600" : "text-ink-soft",
          )}
        >
          {title}
        </span>
      </div>

      <VerdictOption
        name={name}
        tone="ok"
        label={okLabel}
        active={value === "ok"}
        onSelect={() => onChoose("ok")}
      />
      <VerdictOption
        name={name}
        tone="bad"
        label={badLabel}
        active={value === "bad"}
        onSelect={() => onChoose("bad")}
      />
    </div>
  );
}

/**
 * Кнопка вердикта. Внутри настоящая радиокнопка: клавиатура и скринридеры
 * получают поведение группы выбора без ручных обработчиков.
 */
function VerdictOption({
  name,
  tone,
  label,
  active,
  onSelect,
}: {
  name: string;
  tone: "ok" | "bad";
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const tones = {
    ok: {
      active: "bg-flag-green text-white shadow-sm",
      idle: "bg-flag-green/10 text-flag-green hover:bg-flag-green/20",
    },
    bad: {
      active: "bg-flag-red text-white shadow-sm",
      idle: "bg-flag-red/10 text-flag-red hover:bg-flag-red/20",
    },
  } as const;

  return (
    <label className="block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={tone}
        checked={active}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 text-[11px] leading-tight font-extrabold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 sm:gap-1.5 sm:py-2 sm:text-[13px]",
          active ? tones[tone].active : tones[tone].idle,
        )}
      >
        <ThumbIcon up={tone === "ok"} />
        {label}
      </span>
    </label>
  );
}

function ThumbIcon({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 shrink-0 sm:size-4", up ? null : "rotate-180")}
      aria-hidden
    >
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4.2-7a2 2 0 0 1 3.6 1.6L14 8h4.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 19H7" />
    </svg>
  );
}
