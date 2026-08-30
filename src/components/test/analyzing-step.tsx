"use client";

import { useEffect, useState } from "react";
import { fetchAnalysis } from "@/lib/ai/request";
import type { Dictionary } from "@/lib/i18n/ru";
import { saveAnalysis, type TestState } from "@/lib/storage";
import { OrbitLoader } from "./orbit-loader";

/**
 * Сколько держим экран ожидания.
 *
 * Модель отвечает за считанные секунды, а иногда разбора нет вообще и отчёт
 * считается формулами — мгновенный переход выглядел бы так, будто ответы никто
 * не читал. Поэтому экран живёт фиксированное время, разное у разных пар.
 */
const HOLD_MIN_MS = 25_000;
const HOLD_MAX_MS = 30_000;

/** Пауза на заполненной полосе, чтобы конец загрузки было видно. */
const DONE_MS = 500;

/** Полосу не доводим до конца, пока не уходим: конец означает готовность. */
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

  // Выбираем один раз на весь экран. Компонент показывается только сразу после
  // последнего ответа, на сервере не рендерится — расхождения гидрации нет.
  const [hold] = useState(
    () => HOLD_MIN_MS + Math.round(Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS)),
  );

  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  // Надписи распределены по всему ожиданию: последняя приходится на конец.
  useEffect(() => {
    const every = Math.round(hold / steps.length);
    const id = window.setInterval(() => setTick((value) => value + 1), every);

    return () => window.clearInterval(id);
  }, [hold, steps.length]);

  // Полосу ведёт CSS-переход длиной во всё ожидание: без таймера на каждый
  // процент и без десятков перерисовок за эти секунды.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setStarted(true));

    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const opened = Date.now();

    void (async () => {
      const analysis = await fetchAnalysis(state);
      if (cancelled) return;

      if (analysis) saveAnalysis(state, analysis);

      // Разбор готов, но экран отпускаем не раньше срока. Если модель думала
      // дольше — уходим сразу, ждать уже нечего.
      timer = window.setTimeout(
        () => {
          setReady(true);
          timer = window.setTimeout(onDone, DONE_MS);
        },
        Math.max(0, hold - (Date.now() - opened)),
      );
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, onDone, hold]);

  const index = Math.min(tick, steps.length - 1);
  const progress = ready ? 100 : started ? MAX_PROGRESS : 0;

  return (
    <div className="animate-step flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-4">
      <div className="rounded-block shadow-block-lg flex w-full flex-col items-center bg-white p-6 text-center sm:p-8">
        <OrbitLoader />

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
            className="h-full rounded-full bg-pink-500 transition-[width] motion-reduce:transition-none"
            style={{
              width: `${progress}%`,
              transitionDuration: ready ? `${DONE_MS}ms` : `${hold}ms`,
              transitionTimingFunction: ready ? "ease-out" : "linear",
            }}
          />
        </div>

        <p className="mt-3 text-[11px] font-bold text-ink-muted">{texts.note}</p>
      </div>
    </div>
  );
}
