"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import {
  createState,
  EMPTY_PROFILE,
  isAnswered,
  parseState,
  readRawState,
  readServerState,
  saveState,
  subscribeToState,
  withAnswer,
  withProfile,
  type CoupleProfile,
  type TestState,
} from "@/lib/storage";
import { AnalyzingStep } from "./analyzing-step";
import { ProfileStep } from "./profile-step";
import { QuestionStep } from "./question-step";
import { ChoiceStep } from "./choice-step";
import { ScaleStep } from "./scale-step";
import { VerdictStep } from "./verdict-step";
import { TestHeader } from "./test-header";

type Step =
  | { kind: "profile" }
  | { kind: "question"; index: number }
  /** Все ответы собраны: ждём отчёт и уходим на него без кнопок. */
  | { kind: "analyzing" };

type Question = Dictionary["quiz"]["questions"][number];

/** У вопросов с type свой шаг; у остальных — обычные поля ответов. */
function isChoice(
  question: Question,
): question is Extract<Question, { type: "multiple-choice" }> {
  return "type" in question && question.type === "multiple-choice";
}

function isScale(
  question: Question,
): question is Extract<Question, { type: "scale" }> {
  return "type" in question && question.type === "scale";
}

function isVerdict(
  question: Question,
): question is Extract<Question, { type: "verdict" }> {
  return "type" in question && question.type === "verdict";
}

/**
 * Сколько значений должно быть в ответе: у шкалы — по одному на пару,
 * у блиц-опроса — по одному на утверждение.
 */
function slotsOf(question: Question): number {
  if (isScale(question)) return question.pairs.length;
  if (isVerdict(question)) return question.statements.length;

  return 1;
}

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

  // Снимок localStorage: на сервере и при гидрации — пустой, дальше реальный.
  // Так состояние появляется сразу после гидрации, без лишних перерисовок.
  const raw = useSyncExternalStore(
    subscribeToState,
    readRawState,
    readServerState,
  );
  const stored = useMemo<TestState | null>(() => parseState(raw), [raw]);

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

  /**
   * Ожидание показываем только тому, кто прямо сейчас ответил на последний
   * вопрос. Если пара просто открыла тест с готовыми ответами, держать её
   * шесть секунд не за что — уводим в отчёт сразу.
   */
  const justFinished = step?.kind === "analyzing" && stored !== null;
  const skipWait = active.kind === "analyzing" && !justFinished;

  // Стабильная ссылка: экран ожидания держит на ней таймеры и перезапустил бы
  // их, если бы функция пересоздавалась на каждый рендер.
  const goToReport = useCallback(
    () => router.replace(`/${locale}/report`),
    [router, locale],
  );

  useEffect(() => {
    if (skipWait) goToReport();
  }, [skipWait, goToReport]);

  function handleProfile(profile: CoupleProfile) {
    // Язык фиксируется здесь: дальше его сменить нельзя.
    const newState = stored ? withProfile(stored, profile) : createState(profile, locale);
    saveState(newState);
    setStep({ kind: "question", index: 0 });
  }

  function persist(index: number, answer: { she: string; he: string }) {
    if (!stored) return;
    const newState = withAnswer(stored, questions[index].id, questions[index].text, answer);
    saveState(newState);
  }

  function handleNext(index: number, answer: { she: string; he: string }) {
    persist(index, answer);
    setStep(
      index + 1 < total
        ? { kind: "question", index: index + 1 }
        : { kind: "analyzing" },
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
        {/* Форма выше экрана на низких окнах — прокручиваем её саму. */}
        <div
          key="profile"
          className="animate-step flex min-h-0 flex-1 flex-col overflow-y-auto pb-4"
        >
          <ProfileStep
            key="profile-form"
            texts={formTexts}
            header={header}
            initial={stored?.profile ?? EMPTY_PROFILE}
            onSubmit={handleProfile}
          />
        </div>
      </>
    );
  }

  if (active.kind === "analyzing") {
    return (
      <>
        {languageControl}
        {justFinished && stored ? (
          <AnalyzingStep
            key="analyzing"
            texts={quizTexts.analyzing}
            state={stored}
            onDone={goToReport}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-ink-soft">{quizTexts.loading}</p>
          </div>
        )}
      </>
    );
  }

  const index = Math.min(Math.max(active.index, 0), total - 1);
  const question = questions[index];
  const saved = stored?.answers[question.id];
  const initial = { she: saved?.she ?? "", he: saved?.he ?? "" };
  const backLabel = index === 0 ? quizTexts.editProfile : quizTexts.back;

  return (
    <>
      {languageControl}
      {/* key перемонтирует шаг: анимация и подстановка сохранённых ответов.
          Высота шага определена (страница h-dvh), поэтому внутренние flex-1
          умеют сжиматься и список никогда не тянет страницу вниз. */}
      <div
        key={`q-${question.id}`}
        className="animate-step flex min-h-0 flex-1 flex-col"
      >
        {isChoice(question) ? (
          <ChoiceStep
            texts={quizTexts}
            question={question}
            index={index}
            total={total}
            initial={initial}
            backLabel={backLabel}
            onSubmit={(answer) => handleNext(index, answer)}
            onBack={(answer) => handleBack(index, answer)}
            onChange={(answer) => persist(index, answer)}
          />
        ) : isScale(question) ? (
          <ScaleStep
            texts={quizTexts}
            question={question}
            index={index}
            total={total}
            initial={initial}
            backLabel={backLabel}
            onSubmit={(answer) => handleNext(index, answer)}
            onBack={(answer) => handleBack(index, answer)}
            onChange={(answer) => persist(index, answer)}
          />
        ) : isVerdict(question) ? (
          <VerdictStep
            texts={quizTexts}
            question={question}
            index={index}
            total={total}
            initial={initial}
            backLabel={backLabel}
            onSubmit={(answer) => handleNext(index, answer)}
            onBack={(answer) => handleBack(index, answer)}
            onChange={(answer) => persist(index, answer)}
          />
        ) : (
          <QuestionStep
            texts={quizTexts}
            locale={locale}
            question={question}
            index={index}
            total={total}
            initial={initial}
            // Распознавание речи работает только по-русски.
            voiceEnabled={locale === "ru"}
            backLabel={backLabel}
            onSubmit={(answer) => handleNext(index, answer)}
            onBack={(answer) => handleBack(index, answer)}
            onChange={(answer) => persist(index, answer)}
          />
        )}
      </div>
    </>
  );
}

function derive(
  stored: TestState | null,
  questions: Dictionary["quiz"]["questions"],
): Step {
  if (!stored) return { kind: "profile" };

  const firstUnanswered = questions.findIndex(
    (q) => !isAnswered(stored, q.id, slotsOf(q)),
  );

  // Всё заполнено — на тесте делать нечего, уводим в отчёт через ожидание.
  return firstUnanswered === -1
    ? { kind: "analyzing" }
    : { kind: "question", index: firstUnanswered };
}
