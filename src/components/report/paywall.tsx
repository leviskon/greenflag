"use client";

import { cn } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/ru";

type Texts = Dictionary["reportPage"]["paywall"];

/** Что за каркас мигает под замком: у каждого блока он свой по форме. */
export type LockedShape = "value" | "faces" | "donuts" | "rows" | "columns" | "list";

/** Замок: рисуем сами, чтобы не тянуть иконочный набор ради одной картинки. */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("size-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Серая плашка каркаса. */
function Slab({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("rounded-full bg-ink-muted/25", className)} style={style} />
  );
}

/**
 * Каркас закрытого блока.
 *
 * Это декорация, а не спрятанные данные: настоящих чисел и текстов здесь нет
 * и быть не может — до оплаты сервер их не присылает. Форма нужна лишь чтобы
 * блок выглядел как блок, а не как пустая карточка.
 */
function Skeleton({ shape }: { shape: LockedShape }) {
  if (shape === "value") {
    return (
      <div className="flex flex-col gap-3">
        <Slab className="h-9 w-24 rounded-2xl" />
        <Slab className="h-2 w-full" />
        <Slab className="h-2.5 w-11/12" />
        <Slab className="h-2.5 w-4/5" />
      </div>
    );
  }

  if (shape === "faces") {
    return (
      <div className="flex items-center justify-center gap-6">
        <Slab className="size-20 shrink-0 sm:size-24" />
        <Slab className="h-4 w-8" />
        <Slab className="size-20 shrink-0 sm:size-24" />
      </div>
    );
  }

  if (shape === "donuts") {
    return (
      <div className="grid grid-cols-2 gap-6 px-6">
        <Slab className="mx-auto size-24" />
        <Slab className="mx-auto size-24" />
      </div>
    );
  }

  if (shape === "rows") {
    return (
      <div className="flex flex-col gap-4">
        {[80, 62, 71, 55].map((width) => (
          <div key={width} className="flex flex-col gap-1.5">
            <Slab className="h-2 w-24" />
            <Slab className="h-3 w-full" style={{ maxWidth: `${width}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (shape === "columns") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["a", "b"].map((key) => (
          <div key={key} className="flex flex-col items-center gap-2 rounded-2xl bg-canvas p-3">
            <Slab className="size-12" />
            <Slab className="h-2.5 w-20" />
            <Slab className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((key) => (
        <div key={key} className="flex items-center gap-2.5 rounded-2xl bg-canvas p-3">
          <Slab className="size-5 shrink-0" />
          <Slab className="h-2.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * Закрытый раздел отчёта.
 *
 * Номер и заголовок остаются на месте — паре видно, что именно она не открыла.
 * В PDF блок не попадает: у него нет data-pdf-block, а класс no-print убирает
 * его и из окна печати.
 */
export function LockedBlock({
  n,
  title,
  shape,
  texts,
}: {
  n: number;
  title: string;
  shape: LockedShape;
  texts: Texts;
}) {
  return (
    <section className="no-print rounded-block shadow-block avoid-break bg-white p-4 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-muted/30 text-[11px] font-extrabold text-white"
        >
          {n}
        </span>
        <h2 className="min-w-0 flex-1 text-base font-extrabold text-ink-soft sm:text-lg">
          {title}
        </h2>
        <LockIcon className="shrink-0 text-ink-muted" />
      </div>

      <div className="relative mt-4 min-h-32">
        <div
          aria-hidden
          className="pointer-events-none px-1 opacity-70 blur-[7px] select-none"
        >
          <Skeleton shape={shape} />
        </div>

        {/* Поверх каркаса — единственный настоящий текст блока. */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/85 px-5 py-3 text-center shadow-sm backdrop-blur-[2px]">
            <LockIcon className="text-pink-500" />
            <p className="text-[13px] leading-none font-extrabold">
              {texts.lockedTitle}
            </p>
            <p className="text-[11px] leading-snug text-ink-soft">
              {texts.lockedText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export type PaywallStatus =
  /** Обычное состояние: кнопка ждёт нажатия. */
  | "idle"
  /** Создаём платёж и уходим на страницу Finik. */
  | "busy"
  /** Вернулись с оплаты, спрашиваем сервер. */
  | "checking"
  /** Ответ пришёл, но оплаты ещё нет: webhook в пути. */
  | "pending"
  | "error"
  /** Оплата не настроена на сервере. */
  | "unavailable"
  /** Сервер не смог проверить оплату: предлагать платить сейчас нельзя. */
  | "retry"
  /** Закрытую часть больше не открыть: нужно пройти тест заново. */
  | "expired";

/**
 * Карточка с кнопкой оплаты. Стоит сразу после третьего, последнего
 * бесплатного блока — до того, как пара увидит первый замок.
 */
export function PaywallCard({
  texts,
  price,
  status,
  onPay,
  onRecheck,
}: {
  texts: Texts;
  price: number;
  status: PaywallStatus;
  onPay: () => void;
  onRecheck: () => void;
}) {
  const busy = status === "busy" || status === "checking";
  const blocked =
    status === "unavailable" || status === "expired" || status === "retry";

  const message =
    status === "error"
      ? texts.error
      : status === "unavailable"
        ? texts.unavailable
        : status === "retry"
          ? texts.retry
          : status === "expired"
            ? texts.expired
            : status === "pending"
              ? texts.pending
              : status === "checking"
                ? texts.checking
                : null;

  return (
    <section className="no-print rounded-block shadow-block-lg avoid-break bg-white p-5 sm:p-6">
      <p className="text-[11px] font-extrabold tracking-[0.06em] text-pink-600 uppercase">
        {texts.tag}
      </p>

      <h2 className="mt-1 text-[20px] leading-tight font-extrabold sm:text-2xl">
        {texts.title}
      </h2>

      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {texts.lead}
      </p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {texts.items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <LockIcon className="mt-px size-4 shrink-0 text-pink-400" />
            <span className="text-[12px] leading-snug sm:text-[13px]">
              {item}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onPay}
        disabled={busy || blocked}
        aria-busy={busy}
        className="shadow-pill mt-5 w-full rounded-full bg-pink-500 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-pink-600 disabled:opacity-60"
      >
        {status === "busy"
          ? texts.ctaBusy
          : texts.cta.replace("{amount}", String(price))}
      </button>

      <p className="mt-2.5 text-center text-[11px] leading-snug text-ink-muted">
        {texts.note}
      </p>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mt-3 rounded-2xl p-3 text-center text-[12px] leading-snug",
            status === "error" || blocked
              ? "bg-flag-red/10 text-flag-red"
              : "bg-canvas text-ink-soft",
          )}
        >
          {message}
        </p>
      ) : null}

      {status === "pending" ? (
        <button
          type="button"
          onClick={onRecheck}
          className="mx-auto mt-3 block rounded-full bg-canvas px-4 py-2 text-xs font-extrabold text-ink-soft transition-colors hover:text-pink-600"
        >
          {texts.recheck}
        </button>
      ) : null}
    </section>
  );
}

/** Короткая полоса «оплата прошла»: показывается вместо карточки после оплаты. */
export function PaidNote({ text }: { text: string }) {
  return (
    <p className="no-print rounded-2xl bg-flag-green/10 p-3 text-center text-[12px] font-extrabold text-flag-green">
      {text}
    </p>
  );
}
