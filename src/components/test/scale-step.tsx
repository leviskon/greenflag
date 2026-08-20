"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/ru";
import type { AnswerPair, Participant } from "@/lib/storage";
import { StepFooter } from "./step-footer";

type Texts = Dictionary["quiz"];
type Question = Extract<Texts["questions"][number], { type: "scale" }>;

/** Позиции шкалы: 1 — целиком левый вариант, 7 — целиком правый, 4 — между. */
const STEPS = 7;
const POSITIONS = Array.from({ length: STEPS }, (_, i) => i + 1);

/** К центру кружки мельче: так видно, насколько сильно склоняешься к варианту. */
const DOT_SIZE = [
  "size-7 sm:size-11",
  "size-6 sm:size-10",
  "size-5 sm:size-9",
  "size-3.5 sm:size-5",
  "size-5 sm:size-9",
  "size-6 sm:size-10",
  "size-7 sm:size-11",
];

/** Выбор одного участника: по значению на каждую пару, null — ещё не выбрано. */
type Picks = (number | null)[];

/**
 * В localStorage ответ лежит строкой «3,7,1,…» — по одному значению на пару
 * в порядке вопросов. Пустой слот означает «пара не заполнена».
 */
function parsePicks(value: string, length: number): Picks {
  const parts = value ? value.split(",") : [];

  return Array.from({ length }, (_, i) => {
    const parsed = Number(parts[i]);
    const valid =
      parts[i]?.trim() !== "" &&
      Number.isInteger(parsed) &&
      parsed >= 1 &&
      parsed <= STEPS;

    return valid ? parsed : null;
  });
}

function serialize(picks: Picks): string {
  // Пустой ответ пишем пустой строкой, а не «,,,»: так он остаётся «непройденным».
  if (picks.every((pick) => pick === null)) return "";

  return picks.map((pick) => pick ?? "").join(",");
}

/**
 * Вопрос-шкала «или — или»: пара взаимоисключающих вариантов, и каждый
 * участник отмечает, насколько он ближе к одному из них.
 */
export function ScaleStep({
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
  const count = question.pairs.length;

  const [picks, setPicks] = useState<Record<Participant, Picks>>(() => ({
    she: parsePicks(initial.she, count),
    he: parsePicks(initial.he, count),
  }));

  function pick(side: Participant, pairIndex: number, position: number) {
    setPicks((prev) => {
      const next = [...prev[side]];
      next[pairIndex] = position;

      return { ...prev, [side]: next };
    });
  }

  function collect(): AnswerPair {
    return { she: serialize(picks.she), he: serialize(picks.he) };
  }

  const filled = question.pairs.filter(
    (_, i) => picks.she[i] !== null && picks.he[i] !== null,
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
        </h1>
        <p className="mt-1 text-[11px] leading-snug text-ink-muted sm:text-xs">
          {question.subtitle}
        </p>
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
        {question.pairs.map((pair, pairIndex) => (
          <li
            key={pairIndex}
            className="rounded-block shadow-block shrink-0 bg-white p-2 sm:p-4"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full bg-pink-500 text-[10px] font-extrabold text-white sm:size-7 sm:text-xs"
              >
                {pairIndex + 1}
              </span>

              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
                <span className="min-w-0 flex-1 text-right text-[11px] leading-tight font-bold sm:text-sm">
                  {pair.left}
                </span>
                <span className="shrink-0 rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.06em] text-pink-600 uppercase sm:px-2.5 sm:py-1 sm:text-[11px]">
                  {question.orLabel}
                </span>
                <span className="min-w-0 flex-1 text-left text-[11px] leading-tight font-bold sm:text-sm">
                  {pair.right}
                </span>
              </div>
            </div>

            <ScaleRow
              side="she"
              title={texts.turnShe}
              avatar="/woman.png"
              name={`${question.id}-she-${pairIndex}`}
              pair={pair}
              value={picks.she[pairIndex]}
              onPick={(position) => pick("she", pairIndex, position)}
            />
            <ScaleRow
              side="he"
              title={texts.turnHe}
              avatar="/man.png"
              name={`${question.id}-he-${pairIndex}`}
              pair={pair}
              value={picks.he[pairIndex]}
              onPick={(position) => pick("he", pairIndex, position)}
            />
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

/**
 * Ряд шкалы одного участника. Радиокнопки настоящие: клавиатура и
 * скринридеры получают поведение группы выбора без ручных обработчиков.
 */
function ScaleRow({
  side,
  title,
  avatar,
  name,
  pair,
  value,
  onPick,
}: {
  side: Participant;
  title: string;
  avatar: string;
  /** Уникальное имя группы: связывает семь радиокнопок одной пары. */
  name: string;
  pair: { left: string; right: string };
  value: number | null;
  onPick: (position: number) => void;
}) {
  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-1 rounded-2xl px-1 py-1 sm:mt-3 sm:gap-3 sm:rounded-3xl sm:px-3 sm:py-2",
        side === "she" ? "bg-pink-50" : "bg-canvas",
      )}
    >
      {/* Аватар заведомо крупнее самого большого кружка шкалы: по нему сразу
          видно, чей это ряд. */}
      <Image
        src={avatar}
        alt=""
        aria-hidden
        width={1024}
        height={1024}
        sizes="(max-width: 640px) 40px, 64px"
        className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white sm:size-14"
      />

      <div
        role="radiogroup"
        aria-label={`${title}: ${pair.left} / ${pair.right}`}
        className="flex min-w-0 flex-1 items-center"
      >
        {POSITIONS.map((position) => {
          const active = value === position;

          return (
            <label
              key={position}
              // Одинаковая ширина у всех позиций: кружки разного размера, а
              // область нажатия остаётся крупной и на узком экране.
              className="flex h-9 min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center sm:h-14"
            >
              <input
                type="radio"
                name={name}
                value={position}
                checked={active}
                onChange={() => onPick(position)}
                aria-label={`${position} / ${STEPS}`}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2",
                  DOT_SIZE[position - 1],
                  active
                    ? side === "she"
                      ? "border-pink-500 bg-pink-500"
                      : "border-ink-soft bg-ink-soft"
                    : side === "she"
                      ? "border-pink-200 bg-pink-100/70"
                      : "border-line bg-white",
                )}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
