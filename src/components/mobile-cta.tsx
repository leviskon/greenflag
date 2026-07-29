import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Cta } from "./ui";

/** Липкая кнопка на мобильных: главное действие всегда под большим пальцем. */
export function MobileCta({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas/95 px-4 py-3 backdrop-blur sm:hidden">
      <Cta href={`/${locale}/test`} size="lg" className="w-full">
        {dict.cta.takeTogether}
      </Cta>
    </div>
  );
}
