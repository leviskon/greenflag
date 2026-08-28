"use client";

import { useEffect, useState } from "react";
import { HERO_CTA_ID } from "@/lib/content";
import type { Locale } from "@/lib/i18n/config";
import { cn, Cta } from "./ui";

/**
 * Липкая кнопка до lg: главное действие всегда под большим пальцем.
 *
 * Показывается только когда кнопка из первой секции ушла за край экрана —
 * иначе на телефоне в одном кадре видно два одинаковых призыва подряд.
 *
 * Принимает одну строку, а не весь словарь: это клиентский компонент, и всё,
 * что ему передали, уезжает в браузер вместе со страницей. С полным словарём в
 * разметку лендинга попадали и тексты отчёта — все архетипы, силы и риски.
 */
export function MobileCta({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(HERO_CTA_ID);

    // Метки нет (страница без первой секции) — кнопка нужна сразу. Состояние
    // меняем в кадре, а не в теле эффекта: синхронный setState здесь запрещён
    // правилом react-hooks, да и лишний прогон рендера ни к чему.
    if (!anchor) {
      const frame = requestAnimationFrame(() => setVisible(true));

      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      // Небольшой запас снизу: кнопка появляется, когда та уже почти ушла.
      { rootMargin: "-24px 0px 0px 0px" },
    );

    observer.observe(anchor);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      // aria-hidden и pointer-events, чтобы скрытая кнопка не ловила тап и не
      // читалась скринридером, пока её не видно.
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 bg-canvas/95 px-4 py-3 backdrop-blur transition-all duration-300 ease-out motion-reduce:transition-none lg:hidden",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <Cta href={`/${locale}/test`} size="lg" className="w-full">
        {label}
      </Cta>
    </div>
  );
}
