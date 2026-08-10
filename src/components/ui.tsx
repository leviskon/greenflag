import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type CtaProps = {
  href: string;
  children: ReactNode;
  size?: "md" | "lg";
  variant?: "solid" | "soft" | "invert";
  className?: string;
};

/** Кнопка: сплошной розовый, круглые углы, тень вместо бордера. */
export function Cta({
  href,
  children,
  size = "md",
  variant = "solid",
  className,
}: CtaProps) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-200 active:translate-y-px";
  const sizes = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-[15px]",
  } as const;
  const variants = {
    solid: "bg-pink-500 text-white shadow-pill hover:bg-pink-600",
    soft: "bg-white text-ink shadow-block hover:text-pink-600",
    invert: "bg-white text-pink-600 shadow-pill hover:bg-pink-50",
  } as const;

  return (
    <Link
      href={href}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </Link>
  );
}

/** Тег: без фона, пунктирная обводка. */
export function Tag({
  children,
  tone = "pink",
  className,
}: {
  children: ReactNode;
  tone?: "pink" | "ink" | "green" | "red" | "amber";
  className?: string;
}) {
  const tones = {
    pink: "border-pink-300 text-pink-600",
    ink: "border-ink-muted/50 text-ink-muted",
    green: "border-flag-green/45 text-flag-green",
    red: "border-flag-red/45 text-flag-red",
    amber: "border-amber-deep/40 text-amber-deep",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHead({
  tag,
  tone,
  title,
  text,
}: {
  tag: string;
  tone?: "pink" | "ink" | "green" | "red" | "amber";
  title: ReactNode;
  text?: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
      <Tag tone={tone}>{tag}</Tag>
      <h2 className="text-[25px] leading-[1.15] font-extrabold sm:text-3xl lg:text-[34px]">
        {title}
      </h2>
      {text ? (
        <p className="text-sm leading-relaxed text-ink-soft sm:text-[15px]">
          {text}
        </p>
      ) : null}
    </div>
  );
}

/** Карточка: белая подложка, тень, без бордера. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-block shadow-block flex h-full flex-col bg-white p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </div>
    </section>
  );
}
