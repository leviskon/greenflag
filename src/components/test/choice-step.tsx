"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import type { AnswerPair } from "@/lib/storage";

type Texts = Dictionary["quiz"];
type Question = Extract<Texts["questions"][number], { type: "multiple-choice" }>;

const EMOJI_LIST = ["😤", "⚖️", "🏠", "😈", "🕊️", "🎉", "💝", "🔥", "🎯", "⭐", "🌊"];

/**
 * Вопрос с множественным выбором.
 * Каждый участник выбирает несколько вариантов из списка.
 */
export function ChoiceStep({
  texts,
  locale,
  question,
  index,
  total,
  initial,
  backLabel,
  onSubmit,
  onBack,
}: {
  texts: Texts;
  locale: Locale;
  question: Question;
  index: number;
  total: number;
  initial: AnswerPair;
  backLabel: string;
  onSubmit: (answer: AnswerPair) => void;
  onBack: (answer: AnswerPair) => void;
}) {
  // Парсим сохранённые ответы (строка с индексами через запятую)
  const parseInitial = (str: string): number[] => {
    if (!str) return [];
    return str.split(",").map(Number).filter((n) => !isNaN(n));
  };

  const [selectedShe, setSelectedShe] = useState<number[]>(
    parseInitial(initial.she)
  );
  const [selectedHe, setSelectedHe] = useState<number[]>(
    parseInitial(initial.he)
  );

  function toggleOption(side: "she" | "he", optionIndex: number) {
    const setter = side === "she" ? setSelectedShe : setSelectedHe;
    const current = side === "she" ? selectedShe : selectedHe;

    if (current.includes(optionIndex)) {
      setter(current.filter((i) => i !== optionIndex));
    } else {
      setter([...current, optionIndex]);
    }
  }

  function collect(): AnswerPair {
    return {
      she: selectedShe.sort((a, b) => a - b).join(","),
      he: selectedHe.sort((a, b) => a - b).join(","),
    };
  }

  const answer = collect();
  const ready = Boolean(answer.she && answer.he);
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
        <h1 className="text-[15px] font-extrabold leading-snug sm:text-lg">
          {question.text}
        </h1>
        {question.subtitle && (
          <p className="mt-1 text-xs text-ink-muted">{question.subtitle}</p>
        )}
      </div>

      {/* Два столбца с вариантами выбора - фиксированная высота с внутренним скроллом */}
      <div className="grid h-[360px] shrink-0 grid-cols-2 gap-2 sm:h-[420px]">
        <ChoiceColumn
          title={texts.turnShe}
          avatar="/woman.png"
          options={question.options}
          selected={selectedShe}
          onToggle={(idx) => toggleOption("she", idx)}
        />
        <ChoiceColumn
          title={texts.turnHe}
          avatar="/man.png"
          options={question.options}
          selected={selectedHe}
          onToggle={(idx) => toggleOption("he", idx)}
        />
      </div>

      {/* Кнопка идёт с отступом и зафиксирована перед подсказкой */}
      <button
        type="button"
        onClick={() => onSubmit(collect())}
        disabled={!ready}
        className="shadow-pill mt-auto w-full shrink-0 rounded-full bg-pink-500 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-pink-600 active:translate-y-px disabled:bg-pink-200 disabled:shadow-none"
      >
        {isLast ? texts.finish : texts.next}
      </button>

      {/* Подсказка прижата к низу экрана */}
      <p className="shrink-0 pt-2 text-center text-[10px] leading-snug text-ink-muted sm:text-xs">
        {texts.hint}
      </p>
    </div>
  );
}

function ChoiceColumn({
  title,
  avatar,
  options,
  selected,
  onToggle,
}: {
  title: string;
  avatar: string;
  options: string[];
  selected: number[];
  onToggle: (index: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white p-2.5 shadow-block sm:p-3">
      <div className="mb-2 flex shrink-0 items-center gap-1.5 sm:gap-2">
        <img
          src={avatar}
          alt=""
          className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
        />
        <span className="text-xs font-extrabold text-pink-600 sm:text-sm">
          {title}
        </span>
      </div>

      {/* Скроллируемая область с вариантами */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1 scrollbar-thin sm:gap-2">
        {options.map((option, idx) => {
          const isSelected = selected.includes(idx);
          const emoji = EMOJI_LIST[idx % EMOJI_LIST.length];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onToggle(idx)}
              className={`flex shrink-0 items-start gap-2 rounded-2xl p-2.5 text-left text-[11px] font-medium leading-tight transition-all sm:text-xs ${
                isSelected
                  ? "bg-pink-500 text-white shadow-md scale-[0.98]"
                  : "bg-pink-50 text-ink shadow-sm hover:shadow-md hover:bg-pink-100"
              }`}
            >
              <span className="text-base shrink-0 sm:text-lg" aria-hidden>
                {emoji}
              </span>
              <span className="flex-1">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
