import { cn } from "@/components/ui";

/** Сколько колец в сфере. */
const RINGS = 15;

/** Первые кольца крутятся вокруг одной оси, остальные — вокруг другой. */
const SPLIT = 7;

/**
 * Кольца-орбиты: вместо спиннера на экране ожидания разбора.
 *
 * Наклон и задержку считаем здесь, а не в CSS: у каждого кольца они свои,
 * и пятнадцать почти одинаковых правил в таблице стилей ничего не объясняют.
 * Сама анимация — в globals.css (`orbit-a`, `orbit-b`).
 */
export function OrbitLoader({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("orbit relative block size-28 sm:size-36", className)}
    >
      {Array.from({ length: RINGS }, (_, index) => {
        const ring = index + 1;
        const first = ring <= SPLIT;

        return (
          <span
            key={ring}
            className={cn(
              "orbit-ring",
              first ? "orbit-ring--a" : "orbit-ring--b",
            )}
            style={{
              // Держится только до старта анимации: пока идёт задержка,
              // кольцо стоит наклонённым и прозрачным.
              transform: `rotate3d(${first ? "0, 1, 0" : "1, 0, 0"}, ${
                (360 / RINGS) * ring
              }deg)`,
              // Кольца включаются по очереди, а не все сразу.
              animationDelay: `${(ring / 7.5).toFixed(3)}s`,
            }}
          />
        );
      })}
    </span>
  );
}
