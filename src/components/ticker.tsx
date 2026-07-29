import type { Dictionary } from "@/lib/i18n/dictionary";

export function Ticker({ dict }: { dict: Dictionary }) {
  const row = [...dict.ticker, ...dict.ticker];

  return (
    <div className="overflow-hidden py-2" aria-hidden>
      <ul className="flex w-max animate-marquee items-center gap-2.5">
        {row.map((q, i) => (
          <li
            key={`${q}-${i}`}
            className="shrink-0 rounded-full border border-dashed border-pink-200 px-4 py-1.5 text-xs whitespace-nowrap text-ink-soft sm:text-sm"
          >
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}
