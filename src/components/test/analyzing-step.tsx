"use client";

import { useEffect, useState } from "react";
import { fetchAnalysis } from "@/lib/ai/request";
import type { Dictionary } from "@/lib/i18n/ru";
import { saveAnalysis, type TestState } from "@/lib/storage";

/** Как часто меняется надпись. Последняя держится до ответа модели. */
const TICK_MS = 1300;

/** Минимум на экране: если модель ответит мгновенно, кадр не должен мигнуть. */
const MIN_MS = 2200;

/** Полосу не доводим до конца, пока ответа нет: конец означает готовность. */
const MAX_PROGRESS = 92;

/**
 * Экран после последнего вопроса: пока модель разбирает ответы, показываем
 * ожидание, а затем уходим в отчёт.
 *
 * Разбор сохраняется в localStorage рядом с ответами. Если запрос не удался,
 * ничего не сохраняется и отчёт считается формулами — экран в обоих случаях
 * ведёт себя одинаково, потому что пользователю тут решать нечего.
 */
export function AnalyzingStep({
  texts,
  state,
  onDone,
}: {
  texts: Dictionary["quiz"]["analyzing"];
  state: TestState;
  onDone: () => void;
}) {
  const steps = texts.steps;
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), TICK_MS);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const started = Date.now();

    void (async () => {
      const analysis = await fetchAnalysis(state);
      if (cancelled) return;

      if (analysis) saveAnalysis(state, analysis);
      setReady(true);

      timer = window.setTimeout(onDone, Math.max(0, MIN_MS - (Date.now() - started)));
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, onDone]);

  const index = Math.min(tick, steps.length - 1);
  const progress = ready
    ? 100
    : Math.min(MAX_PROGRESS, Math.round(((tick + 1) / (steps.length + 1)) * 100));

  return (
    <div className="animate-step flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-4">
      <div className="rounded-block shadow-block-lg flex w-full flex-col items-center bg-white p-6 text-center sm:p-8">
        <Spinner />

        <h1 className="mt-4 text-xl font-extrabold sm:text-2xl">
          {texts.title}
        </h1>

        {/* aria-live: надписи меняются сами, скринридер должен их проговаривать. */}
        <p
          role="status"
          aria-live="polite"
          className="mt-2 min-h-10 text-sm leading-relaxed text-ink-soft"
        >
          {steps[index]}
        </p>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-pink-100">
          <div
            className="h-full rounded-full bg-pink-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-[11px] font-bold text-ink-muted">{texts.note}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-9 shrink-0 animate-spin rounded-full border-[3px] border-pink-100 border-t-pink-500 motion-reduce:animate-none"
    />
  );
}
