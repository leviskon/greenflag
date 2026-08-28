"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { cn } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import type { AnswerPair, Participant } from "@/lib/storage";
import { StepFooter } from "./step-footer";
import { VoiceAnswer } from "./voice-answer";

type Texts = Dictionary["quiz"];
/** Обычный вопрос: у шагов с вариантами и шкалой есть поле type, здесь его нет. */
type Question = Exclude<Texts["questions"][number], { type: string }>;
type MicError = "unsupported" | "insecure" | "denied" | "failed";

/**
 * Chrome не поддерживает кыргызский в Web Speech API,
 * поэтому для ky используем русское распознавание.
 */
const RECOGNITION_LANG: Record<Locale, string> = {
  ru: "ru-RU",
  ky: "ru-RU",
};

/** Картинка к вопросу, если она есть. Номера файлов — номера вопросов. */
const ILLUSTRATIONS: Record<string, string> = {
  peace: "/sorry.png",
  critique: "/critique.png",
  lastday: "/lastday.png",
  disagree: "/5.png",
  "change-behavior": "/6.png",
  stranger: "/8.png",
  annoy: "/9.png",
  value: "/10.png",
  jealousy: "/11.png",
};

/** Склейка «уже набранное + распознанное» без лишних пробелов. */
function join(base: string, addition: string): string {
  return [base.trim(), addition.trim()].filter(Boolean).join(" ");
}

export function QuestionStep({
  texts,
  locale,
  question,
  index,
  total,
  initial,
  voiceEnabled,
  backLabel,
  onSubmit,
  onBack,
  onChange,
}: {
  texts: Texts;
  locale: Locale;
  question: Question;
  index: number;
  total: number;
  initial: AnswerPair;
  /** Для кыргызского языка голосовой ввод выключен: распознавание только ru. */
  voiceEnabled: boolean;
  backLabel: string;
  onSubmit: (answer: AnswerPair) => void;
  onBack: (answer: AnswerPair) => void;
  /** Ответ сразу уходит в хранилище: перезагрузка ничего не теряет. */
  onChange: (answer: AnswerPair) => void;
}) {
  const [drafts, setDrafts] = useState<AnswerPair>(initial);
  const [recording, setRecording] = useState<Participant | null>(null);
  const [error, setError] = useState<MicError | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  /**
   * Кто диктует и что было в его поле на момент старта записи.
   *
   * Держим в ref, а не в состоянии: распознавание присылает последний кусок
   * текста уже после того, как остановилось, и этот кусок должен попасть
   * в ответ, даже если кнопка микрофона уже вернулась в обычный вид.
   */
  const activeRef = useRef<Participant | null>(null);
  const baseRef = useRef("");
  /** Запись действительно началась: нужно, чтобы поймать остановку по тишине. */
  const startedRef = useRef(false);

  // Распознанный текст сразу становится ответом. Раньше он жил только в
  // выводе поля и переносился в состояние при остановке микрофона — а
  // остановка в Chrome на Android не всегда доходит до конца, и ответ
  // оставался пустым для кнопки «Далее».
  useEffect(() => {
    const side = activeRef.current;
    if (!side || !transcript) return;

    setDrafts((prev) => {
      const merged = join(baseRef.current, transcript);
      return prev[side] === merged ? prev : { ...prev, [side]: merged };
    });
  }, [transcript]);

  // Пропс пересоздаётся на каждый рендер родителя, поэтому храним его в ref:
  // иначе эффект сохранения перезапускался бы без изменения ответа.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const savedRef = useRef<AnswerPair>({
    she: initial.she.trim(),
    he: initial.he.trim(),
  });

  // Любое изменение ответа — с клавиатуры или с голоса — уходит в хранилище.
  useEffect(() => {
    const next = { she: drafts.she.trim(), he: drafts.he.trim() };
    if (next.she === savedRef.current.she && next.he === savedRef.current.he) {
      return;
    }

    savedRef.current = next;
    onChangeRef.current(next);
  }, [drafts]);

  // Chrome на Android не умеет непрерывное распознавание и останавливается
  // сам после паузы. Возвращаем кнопке обычный вид, чтобы диктовку можно было
  // продолжить нажатием. Текст при этом уже в ответе.
  useEffect(() => {
    if (!recording) {
      startedRef.current = false;
      return;
    }

    if (listening) {
      startedRef.current = true;
      return;
    }

    if (startedRef.current) setRecording(null);
  }, [recording, listening]);

  /**
   * Остановка записи. Ответа браузера не ждём: `stopListening` и
   * `abortListening` в react-speech-recognition ждут события `end`, которого
   * уже не будет, если распознавание закончилось само — такой `await`
   * зависает навсегда и вместе с ним зависает переход к следующему шагу.
   */
  function stopMic() {
    activeRef.current = null;
    startedRef.current = false;
    setRecording(null);
    void SpeechRecognition.abortListening();
    resetTranscript();
  }

  async function startMic(side: Participant) {
    if (!voiceEnabled) return;

    if (!browserSupportsSpeechRecognition) {
      setError("unsupported");
      return;
    }

    // Микрофон доступен только в защищённом контексте: HTTPS или localhost.
    if (!window.isSecureContext) {
      setError("insecure");
      return;
    }

    setError(null);
    activeRef.current = side;
    baseRef.current = drafts[side];
    startedRef.current = false;
    setRecording(side);
    resetTranscript();

    try {
      await SpeechRecognition.startListening({
        continuous: browserSupportsContinuousListening,
        language: RECOGNITION_LANG[locale],
      });
    } catch {
      activeRef.current = null;
      setRecording(null);
      setError("failed");
    }
  }

  function toggleMic(side: Participant) {
    if (recording === side) {
      stopMic();
      return;
    }

    if (recording || activeRef.current) stopMic();
    void startMic(side);
  }

  function handleType(side: Participant, value: string) {
    // Ручной ввод перебивает запись: то, что в поле, и становится ответом.
    if (activeRef.current === side || recording === side) stopMic();

    setDrafts((prev) => ({ ...prev, [side]: value }));
  }

  function collect(): AnswerPair {
    return { she: drafts.she.trim(), he: drafts.he.trim() };
  }

  const effectiveError: MicError | null =
    error ?? (recording && !isMicrophoneAvailable ? "denied" : null);

  function caption(side: Participant) {
    if (!voiceEnabled) return texts.micTextOnly;

    if (effectiveError && (recording === side || recording === null)) {
      return {
        unsupported: texts.micUnsupported,
        insecure: texts.micInsecure,
        denied: texts.micDenied,
        failed: texts.micError,
      }[effectiveError];
    }

    if (recording === side && listening) return texts.micListening;
    return texts.micIdle;
  }

  const answer = collect();
  const ready = Boolean(answer.she && answer.he);
  const isLast = index + 1 === total;
  const illustration = ILLUSTRATIONS[question.id];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopMic();
            onBack(collect());
          }}
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

      {/* Вопрос с картинкой: текст слева, картинка справа — как на форме
          данных пары. Без картинки вопрос остаётся по центру. */}
      <div className="flex shrink-0 items-center gap-3">
        <h1
          className={cn(
            "min-w-0 flex-1 text-base leading-snug font-extrabold sm:text-lg",
            illustration ? "text-left" : "text-center",
          )}
        >
          {question.text}
        </h1>

        {/* Через next/image, иначе телефон тянет исходные PNG
            по 1–1,5 МБ и вкладка может перезагрузиться. */}
        {illustration ? (
          <Image
            src={illustration}
            alt=""
            aria-hidden
            width={1024}
            height={1024}
            sizes="(max-width: 640px) 128px, (max-width: 1024px) 176px, 208px"
            className="h-auto w-32 shrink-0 sm:w-44 lg:w-52"
          />
        ) : null}
      </div>

      {/* Блоки ответов не тянутся на весь экран: высота ограничена,
          лишнее место распределяется вокруг. */}
      <div className="grid max-h-[40dvh] min-h-24 flex-1 grid-cols-2 gap-2 sm:max-h-64">
        <VoiceAnswer
          side="she"
          title={texts.turnShe}
          avatar="/woman.png"
          value={drafts.she}
          placeholder={`${texts.examplePrefix} ${question.exampleShe}`}
          onChange={(value) => handleType("she", value)}
          listening={recording === "she" && listening}
          blocked={Boolean(effectiveError)}
          voiceEnabled={voiceEnabled}
          onToggleMic={() => toggleMic("she")}
          caption={caption("she")}
          micLabel={
            recording === "she" && listening ? texts.micStop : texts.micStart
          }
        />
        <VoiceAnswer
          side="he"
          title={texts.turnHe}
          avatar="/man.png"
          value={drafts.he}
          placeholder={`${texts.examplePrefix} ${question.exampleHe}`}
          onChange={(value) => handleType("he", value)}
          listening={recording === "he" && listening}
          blocked={Boolean(effectiveError)}
          voiceEnabled={voiceEnabled}
          onToggleMic={() => toggleMic("he")}
          caption={caption("he")}
          micLabel={
            recording === "he" && listening ? texts.micStop : texts.micStart
          }
        />
      </div>

      <StepFooter
        label={isLast ? texts.finish : texts.next}
        hint={texts.hint}
        disabled={!ready}
        onClick={() => {
          stopMic();
          onSubmit(collect());
        }}
      />
    </div>
  );
}
