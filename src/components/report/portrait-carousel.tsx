"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/components/ui";

export type PortraitSlide = {
  /** Заголовок блока: «Архетип вашей пары», «Ваша супер-сила», «Ваша зона риска». */
  title: string;
  /** Название метки: крупно на картинке. */
  name: string;
  text: string;
  /** Путь к баннеру: картинки есть у всех архетипов, сил и рисков. */
  art: string;
};

/**
 * Карусель портрета пары: архетип, супер-сила и зона риска.
 *
 * Слайды лежат в одном ряду и сдвигаются трансформом — так переход плавный,
 * а в печать уходит первый слайд. Пролистывание работает кнопками, точками и
 * свайпом.
 */
export function PortraitCarousel({
  slides,
  n,
  prevLabel,
  nextLabel,
  slideLabel,
}: {
  slides: PortraitSlide[];
  /** Номер блока в отчёте: одинаковый у всех слайдов, как у примера. */
  n: number;
  prevLabel: string;
  nextLabel: string;
  /** Шаблон подписи точки, например «Слайд {n}». */
  slideLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const total = slides.length;
  const go = (index: number) => setActive((index + total) % total);

  function handleTouchEnd(endX: number) {
    if (touchStart === null) return;

    const delta = endX - touchStart;
    setTouchStart(null);

    // 40px — порог, чтобы обычный тап не считался свайпом.
    if (Math.abs(delta) < 40) return;
    go(delta < 0 ? active + 1 : active - 1);
  }

  return (
    // Без avoid-break: в печати слайды разворачиваются в столбец, и целиком
    // блок в лист уже не влезает. Разрыв запрещён каждому слайду отдельно
    // (.print-slide в globals.css).
    <section className="rounded-block shadow-block bg-white p-4 print:shadow-none sm:p-6">
      <div className="overflow-hidden">
        <div
          className="print-slides flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${active * 100}%)` }}
          onTouchStart={(event) => setTouchStart(event.touches[0].clientX)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX)}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              className="print-slide w-full shrink-0"
              aria-hidden={index !== active}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-pink-500 text-[11px] font-extrabold text-white"
                >
                  {n}
                </span>
                <h2 className="text-base font-extrabold sm:text-lg">
                  {slide.title}
                </h2>
              </div>

              {/* Пропорции взяты у исходных картинок: 1573×672. Градиент под
                  ними виден только пока баннер грузится. */}
              <div className="relative mt-3 aspect-[1573/672] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-pink-400 to-pink-600">
                {/* Название вписано в сам баннер, поэтому текстом его не
                    дублируем: оно уходит в alt для скринридеров.

                    eager у всех трёх: соседние слайды сдвинуты за край
                    контейнера, ленивая загрузка их не начинает, и после
                    пролистывания баннер догружался бы на глазах.
                    priority в Next 16 объявлен устаревшим. */}
                <Image
                  src={slide.art}
                  alt={slide.name}
                  fill
                  loading="eager"
                  sizes="(max-width: 640px) 100vw, 640px"
                  className="object-cover"
                />
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft sm:text-sm">
                {slide.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="no-print mt-4 flex items-center justify-center gap-4">
        <Arrow label={prevLabel} onClick={() => go(active - 1)} direction="prev" />

        <span className="flex items-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => go(index)}
              aria-label={slideLabel.replace("{n}", String(index + 1))}
              aria-current={index === active ? "true" : undefined}
              className={cn(
                "h-2 rounded-full transition-all",
                index === active ? "w-5 bg-pink-500" : "w-2 bg-pink-200",
              )}
            />
          ))}
        </span>

        <Arrow label={nextLabel} onClick={() => go(active + 1)} direction="next" />
      </div>
    </section>
  );
}

function Arrow({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full text-ink-muted transition-colors hover:text-pink-600"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-4", direction === "prev" ? "rotate-180" : null)}
        aria-hidden
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
