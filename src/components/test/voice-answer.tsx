"use client";

import Image from "next/image";
import { cn } from "@/components/ui";

export type VoiceSide = "she" | "he";

/** Одна колонка ответа: аватар, поле ввода и кнопка микрофона. */
export function VoiceAnswer({
  side,
  title,
  avatar,
  value,
  placeholder,
  onChange,
  listening,
  blocked,
  onToggleMic,
  caption,
  micLabel,
  voiceEnabled,
}: {
  side: VoiceSide;
  title: string;
  avatar: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  listening: boolean;
  blocked: boolean;
  onToggleMic: () => void;
  caption: string;
  micLabel: string;
  /** Если голосовой ввод выключен, кнопку микрофона не показываем вообще. */
  voiceEnabled: boolean;
}) {
  return (
    <div className="rounded-block shadow-block flex min-h-0 flex-col bg-white p-2 sm:p-2.5">
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1",
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
          className="size-7 shrink-0 rounded-full object-cover sm:size-8"
        />
        <span
          className={cn(
            "text-[11px] font-extrabold sm:text-xs",
            side === "she" ? "text-pink-600" : "text-ink-soft",
          )}
        >
          {title}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={title}
        className={cn(
          // min-h-0 позволяет полю сжиматься по блоку, overflow-y-auto включает
          // прокрутку внутри поля, когда текста больше, чем места.
          "mt-1.5 min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-2xl px-2.5 py-1.5 text-[12px] leading-snug text-ink outline-none placeholder:text-ink-muted/80 placeholder:italic sm:text-[13px]",
          listening ? "bg-pink-50 ring-2 ring-pink-400" : "bg-canvas",
        )}
      />

      <div className="mt-1.5 flex shrink-0 flex-col items-center gap-0.5">
        {voiceEnabled ? (
        <button
          type="button"
          onClick={onToggleMic}
          aria-pressed={listening}
          aria-label={micLabel}
          title={micLabel}
          className={cn(
            "grid size-10 place-items-center rounded-full transition-colors sm:size-11",
            blocked
              ? "bg-line text-ink-muted"
              : listening
                ? "animate-mic bg-pink-600 text-white"
                : "shadow-pill bg-pink-500 text-white hover:bg-pink-600",
          )}
        >
          {listening ? <Equalizer /> : <MicIcon />}
        </button>
        ) : null}

        <span
          className={cn(
            "text-center text-[10px] leading-tight",
            listening
              ? "font-extrabold text-pink-600"
              : blocked
                ? "font-bold text-flag-red"
                : "text-ink-muted",
          )}
        >
          {listening ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 animate-mic rounded-full bg-pink-600" />
              {caption}
            </span>
          ) : (
            caption
          )}
        </span>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/** Живой индикатор записи вместо статичной иконки. */
function Equalizer() {
  return (
    <span aria-hidden className="flex h-5 items-center gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="animate-bar block w-[3px] rounded-full bg-current"
          style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}
