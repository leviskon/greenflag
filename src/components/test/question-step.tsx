"use client";

import { useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/ru";
import type { AnswerPair, Participant } from "@/lib/storage";
import { VoiceAnswer } from "./voice-answer";

type Texts = Dictionary["quiz"];
type Question = Texts["questions"][number];
type MicError = "unsupported" | "insecure" | "denied" | "failed";

/**
 * Chrome не поддерживает кыргызский в Web Speech API,
 * поэтому для ky используем русское распознавание.
 */
const RECOGNITION_LANG: Record<Locale, string> = {
  ru: "ru-RU",
  ky: "ru-RU",
};

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

  // Распознанный текст показываем прямо в поле, не трогая состояние в эффектах.
  function shown(side: Participant) {
    if (recording !== side || !transcript) return drafts[side];
    return [drafts[side], transcript].filter(Boolean).join(" ");
  }

  function commit(side: Participant) {
    const merged = [drafts[side], transcript].filter(Boolean).join(" ").trim();
    setDrafts((prev) => ({ ...prev, [side]: merged }));
    resetTranscript();
  }

  async function stopMic(side: Participant) {
    try {
      await SpeechRecognition.stopListening();
    } catch {
      // Остановка уже произошла — состояние всё равно фиксируем.
    }
    commit(side);
    setRecording(null);
  }

  async function toggleMic(side: Participant) {
    if (recording === side) {
      await stopMic(side);
      return;
    }

    if (recording) await stopMic(recording);

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
    resetTranscript();
    setRecording(side);

    try {
      await SpeechRecognition.startListening({
        continuous: browserSupportsContinuousListening,
        interimResults: true,
        language: RECOGNITION_LANG[locale],
      });
    } catch {
      setRecording(null);
      setError("failed");
    }
  }

  function handleType(side: Participant, value: string) {
    // Ручной ввод перебивает запись: то, что в поле, и становится ответом.
    if (recording === side) {
      void SpeechRecognition.stopListening();
      resetTranscript();
      setRecording(null);
    }
    setDrafts((prev) => ({ ...prev, [side]: value }));
  }

  function collect(): AnswerPair {
    return { she: shown("she").trim(), he: shown("he").trim() };
  }

  async function leave() {
    if (recording) {
      try {
        await SpeechRecognition.stopListening();
      } catch {
        // Не мешаем переходу к следующему шагу.
      }
    }
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={async () => {
            await leave();
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

      <h1 className="shrink-0 text-center text-[15px] leading-snug font-extrabold sm:text-lg">
        {question.text}
      </h1>

      {/* Картинки для вопросов */}
      {question.id === "peace" && (
        <div className="shrink-0 flex justify-center py-2">
          <img 
            src="/sorry.png" 
            alt="" 
            className="max-w-[120px] sm:max-w-[150px]"
          />
        </div>
      )}
      {question.id === "critique" && (
        <div className="shrink-0 flex justify-center py-2">
          <img 
            src="/critique.png" 
            alt="" 
            className="max-w-[120px] sm:max-w-[150px]"
          />
        </div>
      )}

      {/* Блоки ответов не тянутся на весь экран: высота ограничена,
          лишнее место распределяется вокруг. */}
      <div className="grid max-h-[40vh] min-h-36 flex-1 grid-cols-2 gap-2 sm:max-h-64">
        <VoiceAnswer
          side="she"
          title={texts.turnShe}
          avatar="/woman.png"
          value={shown("she")}
          placeholder={`${texts.examplePrefix} ${question.exampleShe}`}
          onChange={(value) => handleType("she", value)}
          listening={recording === "she" && listening}
          blocked={Boolean(effectiveError)}
          voiceEnabled={voiceEnabled}
          onToggleMic={() => void toggleMic("she")}
          caption={caption("she")}
          micLabel={
            recording === "she" && listening ? texts.micStop : texts.micStart
          }
        />
        <VoiceAnswer
          side="he"
          title={texts.turnHe}
          avatar="/man.png"
          value={shown("he")}
          placeholder={`${texts.examplePrefix} ${question.exampleHe}`}
          onChange={(value) => handleType("he", value)}
          listening={recording === "he" && listening}
          blocked={Boolean(effectiveError)}
          voiceEnabled={voiceEnabled}
          onToggleMic={() => void toggleMic("he")}
          caption={caption("he")}
          micLabel={
            recording === "he" && listening ? texts.micStop : texts.micStart
          }
        />
      </div>

      {/* Кнопка идёт сразу под блоками ответов. */}
      <button
        type="button"
        onClick={async () => {
          await leave();
          onSubmit(collect());
        }}
        disabled={!ready}
        className="shadow-pill w-full shrink-0 rounded-full bg-pink-500 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-pink-600 active:translate-y-px disabled:bg-pink-200 disabled:shadow-none"
      >
        {isLast ? texts.finish : texts.next}
      </button>

      {/* Подсказка остаётся прижатой к низу экрана. */}
      <p className="mt-auto shrink-0 pt-2 text-center text-[10px] leading-snug text-ink-muted sm:text-xs">
        {texts.hint}
      </p>
    </div>
  );
}
