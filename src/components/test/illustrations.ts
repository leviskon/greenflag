import { getImageProps } from "next/image";

/** Картинка к вопросу, если она есть. Номера файлов — номера вопросов. */
export const ILLUSTRATIONS: Record<string, string> = {
  peace: "/sorry.png",
  critique: "/critique.png",
  lastday: "/lastday.png",
  disagree: "/5.png",
  "change-behavior": "/6.png",
  stranger: "/8.png",
  annoy: "/9.png",
  value: "/10.png",
  jealousy: "/11.png",
};

/**
 * Размеры картинки вопроса.
 *
 * Лежат рядом с прогревом кэша не случайно: браузер выбирает вариант из
 * `srcSet` по `sizes`, и если прогреть другой размер, толку не будет —
 * на показе вопроса уйдёт новый запрос.
 */
export const ILLUSTRATION_SIZES =
  "(max-width: 640px) 128px, (max-width: 1024px) 176px, 208px";

/** Исходники квадратные, 1024×1024. */
const SOURCE_SIZE = 1024;

/** Сколько картинок тянем одновременно: телефону хватает двух. */
const PARALLEL = 2;

/** Адреса, которые запросит `<Image>` для этой картинки. */
function optimized(source: string) {
  const { props } = getImageProps({
    src: source,
    alt: "",
    width: SOURCE_SIZE,
    height: SOURCE_SIZE,
    sizes: ILLUSTRATION_SIZES,
  });

  return props;
}

/** Картинки вопросов в порядке прохождения, начиная с текущего. */
export function illustrationQueue(
  ids: readonly string[],
  from = 0,
): string[] {
  const order = [...ids.slice(from), ...ids.slice(0, from)];

  return order
    .map((id) => ILLUSTRATIONS[id])
    .filter((source): source is string => Boolean(source));
}

/**
 * Прогрев кэша картинок вопросов.
 *
 * Картинка попадает в разметку вместе со своим вопросом, поэтому и запрос
 * уходит в момент показа: сервер пережимает исходный PNG (0,6–1,4 МБ), потом
 * браузер его качает — и на каждом шаге видна задержка. Здесь мы заранее
 * просим ровно те адреса, которые запросит `<Image>`, так что к своему
 * вопросу картинка уже лежит в кэше и рисуется сразу.
 *
 * Возвращает отмену: остаток очереди не грузим.
 */
export function warmIllustrations(sources: readonly string[]): () => void {
  if (typeof window === "undefined") return () => {};

  const queue = [...new Set(sources)];
  /** Ссылки держим до конца загрузки: иначе сборка мусора прервёт запрос. */
  const loading = new Set<HTMLImageElement>();
  let cancelled = false;

  function pull() {
    if (cancelled) return;

    const source = queue.shift();
    if (!source) return;

    const { src, srcSet, sizes } = optimized(source);
    const image = new window.Image();

    loading.add(image);

    const done = () => {
      loading.delete(image);
      pull();
    };

    image.onload = done;
    image.onerror = done;
    // Прогрев не должен мешать текущему шагу — он всегда во второй очереди.
    image.setAttribute("fetchpriority", "low");
    // Порядок важен: без sizes и srcSet браузер возьмёт из src полный PNG.
    if (sizes) image.sizes = sizes;
    if (srcSet) image.srcset = srcSet;
    if (src) image.src = src;
  }

  for (let i = 0; i < PARALLEL; i += 1) pull();

  return () => {
    cancelled = true;
    queue.length = 0;
    loading.clear();
  };
}
