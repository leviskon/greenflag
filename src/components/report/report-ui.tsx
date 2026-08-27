import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import type { Tone } from "@/lib/report";

/** Цвета тона одинаковые во всём отчёте: зелёный — хорошо, красный — плохо. */
export const TONE_TEXT: Record<Tone, string> = {
  good: "text-flag-green",
  mid: "text-amber-deep",
  bad: "text-flag-red",
};

const TONE_STROKE: Record<Tone, string> = {
  good: "stroke-flag-green",
  mid: "stroke-amber-deep",
  bad: "stroke-flag-red",
};

/**
 * Блок отчёта: белая карточка с номером и заголовком.
 * avoid-break нужен печати — карточка не должна рваться между страницами.
 */
export function ReportBlock({
  n,
  title,
  note,
  children,
  className,
}: {
  n: number;
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-block shadow-block avoid-break bg-white p-4 print:shadow-none sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded-full bg-pink-500 text-[11px] font-extrabold text-white"
        >
          {n}
        </span>
        <h2 className="text-base font-extrabold sm:text-lg">{title}</h2>
      </div>

      {note ? (
        <p className="mt-1.5 text-[11px] leading-snug text-ink-muted sm:text-xs">
          {note}
        </p>
      ) : null}

      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Круговая диаграмма: значение в процентах внутри кольца. */
export function Donut({
  value,
  tone,
  label,
  size = 84,
}: {
  value: number;
  tone: Tone;
  label: string;
  size?: number;
}) {
  const radius = 40;
  const length = 2 * Math.PI * radius;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * length;

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 88 88" className="size-full" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            className={cn(TONE_STROKE[tone], "opacity-15")}
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${length - filled}`}
            transform="rotate(-90 44 44)"
            className={TONE_STROKE[tone]}
          />
        </svg>
        <span
          className={cn(
            "font-display absolute inset-0 grid place-items-center text-[15px] font-extrabold",
            TONE_TEXT[tone],
          )}
        >
          {value}%
        </span>
      </div>

      {/* Названия метрик длинные, поэтому переносим их по смыслу и не режем. */}
      <span className="text-[11px] leading-tight font-bold text-balance text-ink-soft sm:text-xs">
        {label}
      </span>
    </div>
  );
}

/** Полоса прогресса: используем для совместимости и рисков. */
export function Bar({ value, tone }: { value: number; tone: Tone }) {
  const fill = {
    good: "bg-flag-green",
    mid: "bg-amber-deep",
    bad: "bg-flag-red",
  }[tone];

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-pink-100">
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

/**
 * Заблокированный блок: настоящий текст появится в полной версии, поэтому
 * показываем заглушку под размытием. В печати размытие убираем — принтеры и
 * PDF рендерят backdrop-filter непредсказуемо.
 */
export function LockedBlock({
  tag,
  title,
  placeholder,
}: {
  tag: string;
  title: string;
  placeholder: string;
}) {
  return (
    // h-full: соседние карточки в ряду выравниваются по самой высокой.
    <div className="rounded-block shadow-block avoid-break flex h-full flex-col bg-white p-4 print:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-extrabold text-balance sm:text-base">
          {title}
        </h3>
        <span className="shrink-0 rounded-full border border-dashed border-ink-muted/50 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
          {tag}
        </span>
      </div>

      {/* Размытие накрывает только заглушку. Раньше оно шло от фиксированного
          отступа сверху и заезжало на заголовок, когда тот вставал в две строки. */}
      <div className="relative mt-3 flex min-h-28 flex-1 items-center overflow-hidden rounded-2xl bg-canvas p-3">
        <p
          aria-hidden
          className="text-[12px] leading-snug text-ink opacity-40"
        >
          {placeholder}
        </p>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white/30 backdrop-blur-[2px] print:bg-white/75 print:backdrop-blur-none"
        />

        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-ink-muted"
        >
          <LockIcon />
        </span>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="10" rx="2.5" fill="currentColor" stroke="none" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
