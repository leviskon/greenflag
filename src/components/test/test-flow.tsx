"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Tag } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import {
  clearState,
  createState,
  EMPTY_PROFILE,
  isAnswered,
  parseState,
  readRawState,
  saveState,
  withAnswer,
  withProfile,
  type CoupleProfile,
  type TestState,
} from "@/lib/storage";
import { ProfileStep } from "./profile-step";
import { QuestionStep } from "./question-step";
import { TestHeader } from "./test-header";

type Step =
  | { kind: "profile" }
  | { kind: "question"; index: number }
  | { kind: "done" };

/**
 * Все шаги теста живут на одной странице: переходы делаются сменой блока
 * с короткой анимацией, без навигации и перезагрузки.
 */
export function TestFlow({
  formTexts,
  quizTexts,
  switcherLabel,
  locale,
  header,
}: {
  formTexts: Dictionary["testForm"];
  quizTexts: Dictionary["quiz"];
  switcherLabel: string;
  locale: Locale;
  header: React.ReactNode;
}) {
  const router = useRouter();
  const questions = quizTexts.questions;
  const total = questions.length;

  const [step, setStep] = useState<Step | null>(null);
  const [stored, setStored] = useState<TestState | null>(null);

  useEffect(() => {
    // Читаем из localStorage только на клиенте
    const raw = readRawState();
    setStored(parseState(raw));

    // Подписываемся на изменения
    const handleChange = () => {
      const newRaw = readRawState();
      setStored(parseState(newRaw));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleChange);
      window.addEventListener("greenflag:test-state", handleChange);

      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener("greenflag:test-state", handleChange);
      };
    }
  }, []);

  const languageControl = (
    <TestHeader
      locale={locale}
      path="/test"
      switcherLabel={switcherLabel}
      locked={stored !== null}
      lockedLabel={quizTexts.localeLocked}
    />
  );

  // Тест начат на другом языке — возвращаем пользователя к нему,
  // чтобы вопросы и ответы остались на одном языке.
  const mismatch = stored !== null && stored.locale !== locale;

  useEffect(() => {
    if (mismatch && stored) router.replace(`/${stored.locale}/test`);
  }, [mismatch, stored, router]);

  const active: Step = step ?? derive(stored, questions);

  function handleProfile(profile: CoupleProfile) {
    // Язык фиксируется здесь: дальше его сменить нельзя.
    const newState = stored ? withProfile(stored, profile) : createState(profile, locale);
    saveState(newState);
    setStep({ kind: "question", index: 0 });
  }

  function persist(index: number, answer: { she: string; he: string }) {
    if (!stored) return;
    saveState(withAnswer(stored, questions[index].id, questions[index].text, answer));
  }

  function handleNext(index: number, answer: { she: string; he: string }) {
    persist(index, answer);
    setStep(
      index + 1 < total
        ? { kind: "question", index: index + 1 }
        : { kind: "done" },
    );
  }

  function handleBack(index: number, answer: { she: string; he: string }) {
    persist(index, answer);
    // С первого вопроса возвращаемся к данным пары.
    setStep(
      index === 0
        ? { kind: "profile" }
        : { kind: "question", index: index - 1 },
    );
  }

  // Показываем загрузку только если обнаружено несоответствие языка и идёт редирект
  if (mismatch) {
    return (
      <>
        {languageControl}
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink-soft">{quizTexts.loading}</p>
        </div>
      </>
    );
  }

  if (active.kind === "profile") {
    return (
      <>
        {languageControl}
        <div key="profile" className="animate-step flex flex-1 flex-col">
          <ProfileStep
            texts={formTexts}
            header={header}
            initial={stored?.profile ?? EMPTY_PROFILE}
            onSubmit={handleProfile}
          />
        </div>
      </>
    );
  }

  if (active.kind === "done") {
    const answered = questions.filter((q) =>
      stored ? isAnswered(stored, q.id) : false,
    ).length;

    return (
      <>
        {languageControl}
        <div
          key="done"
          className="animate-step flex flex-1 items-center justify-center py-4"
        >
          <div className="rounded-block shadow-block-lg flex w-full flex-col items-center bg-white p-6 text-center sm:p-8">
            <span aria-hidden className="text-3xl">
              💌
            </span>
            <h1 className="mt-3 text-xl font-extrabold sm:text-2xl">
              {quizTexts.doneTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {quizTexts.doneText}
            </p>
            <p className="mt-4">
              <Tag tone="green">
                {quizTexts.doneCounter}: {answered} / {total}
              </Tag>
            </p>

            <div className="mt-5 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => setStep({ kind: "question", index: total - 1 })}
                className="shadow-block rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-ink transition-colors hover:text-pink-600"
              >
                ← {quizTexts.back}
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link
                  href={`/${locale}`}
                  className="shadow-pill rounded-full bg-pink-500 px-6 py-2.5 text-center text-sm font-extrabold text-white transition-colors hover:bg-pink-600"
                >
                  GreenFlag
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    clearState();
                    setStep({ kind: "profile" });
                  }}
                  className="shadow-block rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-ink transition-colors hover:text-pink-600"
                >
                  {quizTexts.restart}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const index = Math.min(Math.max(active.index, 0), total - 1);
  const question = questions[index];
  const saved = stored?.answers[question.id];

  return (
    <>
      {languageControl}
      {/* key перемонтирует шаг: анимация и подстановка сохранённых ответов */}
      <div
        key={`q-${question.id}`}
        className="animate-step flex min-h-0 flex-1 flex-col"
      >
        <QuestionStep
          texts={quizTexts}
          locale={locale}
          question={question}
          index={index}
          total={total}
          initial={{ she: saved?.she ?? "", he: saved?.he ?? "" }}
          // Распознавание речи работает только по-русски.
          voiceEnabled={locale === "ru"}
          backLabel={index === 0 ? quizTexts.editProfile : quizTexts.back}
          onSubmit={(answer) => handleNext(index, answer)}
          onBack={(answer) => handleBack(index, answer)}
        />
      </div>
    </>
  );
}

function derive(
  stored: TestState | null,
  questions: Dictionary["quiz"]["questions"],
): Step {
  if (!stored) return { kind: "profile" };

  const firstUnanswered = questions.findIndex((q) => !isAnswered(stored, q.id));

  return firstUnanswered === -1
    ? { kind: "done" }
    : { kind: "question", index: firstUnanswered };
}
