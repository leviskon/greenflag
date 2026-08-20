/**
 * Низ шага теста: кнопка перехода и подсказка. Блок прижат к низу экрана
 * (sticky, а не fixed — так он остаётся в потоке и под него не нужно вручную
 * резервировать место) и не уезжает, даже если содержимое шага прокручивают.
 */
export function StepFooter({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto shrink-0 bg-canvas pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="shadow-pill w-full rounded-full bg-pink-500 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-pink-600 active:translate-y-px disabled:bg-pink-200 disabled:shadow-none"
      >
        {label}
      </button>

      <p className="pt-2 text-center text-[10px] leading-snug text-ink-muted sm:text-xs">
        {hint}
      </p>
    </div>
  );
}
