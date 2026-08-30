/**
 * Сборка PDF на клиенте.
 *
 * Печать через window.print() всегда открывает окно принтера — это поведение
 * браузера, страница его отменить не может. Поэтому файл собираем сами:
 * каждый блок отчёта снимаем в картинку и раскладываем по страницам A4.
 *
 * Библиотеки грузятся по требованию: вместе они весят больше, чем вся страница
 * отчёта, и тянуть их до нажатия кнопки нет смысла.
 */

/** Лист A4 в пунктах — в них считает jsPDF. */
const PAGE = { width: 595.28, height: 841.89 };

/** Поля страницы и зазор между блоками. */
const MARGIN = 28;
const GAP = 12;

/**
 * Окно, в котором снимаем отчёт.
 *
 * html2canvas раскладывает копию страницы в скрытом iframe этого размера, и
 * media-запросы считаются по нему. Размер задаём сами, чтобы файл не зависел от
 * устройства: колонка отчёта раскрывается на свои max-w-2xl и включаются
 * sm:-правила. С ширины телефона блоки выходили узкими и длинными — каждый
 * занимал отдельный лист, а по бокам оставались пустые поля.
 */
const CAPTURE_WIDTH = 768;
const CAPTURE_HEIGHT = 1024;

/**
 * Плотность съёмки. 2 — примерно 165 dpi на A4: текст читается, файл остаётся
 * в пределах пары мегабайт. Выше — заметно тяжелее без большой пользы.
 */
const SCALE = 2;

/** JPEG вместо PNG: у скриншотов с фото PNG крупнее в разы. */
const QUALITY = 0.92;

/** Блоки отчёта помечены этим атрибутом — он же задаёт порядок в файле. */
export const PDF_BLOCK_ATTR = "data-pdf-block";

/** Сколько ждём картинки, прежде чем собирать файл без них. */
const IMAGES_TIMEOUT_MS = 6000;

/**
 * Стили для копии страницы.
 *
 * Копия живёт в iframe как обычная страница «на экране»: @media print к ней не
 * применяется, а CSS-анимации стартуют в ней заново. Из-за этого блоки уходили
 * в файл полупрозрачными и белыми — снимок делался, пока анимация появления
 * (.reveal) ещё шла, а у нижних блоков она из-за задержки по nth-child даже не
 * начиналась. Поэтому анимации и переходы гасим, а печатные правила, от которых
 * зависит раскладка, повторяем здесь же.
 */
const CAPTURE_CSS = `
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}

/* Конечное состояние появления: блок виден и стоит на своём месте. */
.reveal > * {
  opacity: 1 !important;
  transform: none !important;
}

/* Кнопки, стрелки и точки карусели в файле не нужны. */
.no-print {
  display: none !important;
}

[class*="sticky"] {
  position: static !important;
}

/* Слайды карусели лежат в ряду, сдвинутом трансформом: без этого в файл
   попал бы только открытый слайд, да ещё и со смещением. */
.print-slides {
  display: block !important;
  transform: none !important;
}

.print-slide {
  width: 100% !important;
}
`;

/**
 * Догружаем картинки отчёта.
 *
 * Аватары и портреты грузятся лениво, и если пара нажала кнопку не прокрутив
 * страницу, часть картинок ещё не загружена — в файл они попали бы пустыми.
 */
async function waitForImages(root: HTMLElement): Promise<void> {
  const pending = Array.from(root.querySelectorAll("img")).map((image) => {
    image.loading = "eager";
    if (image.complete && image.naturalWidth > 0) return null;

    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });

  const waiting = pending.filter((item): item is Promise<void> => item !== null);
  if (waiting.length === 0) return;

  // Битая картинка не должна подвесить кнопку.
  await Promise.race([
    Promise.all(waiting),
    new Promise((resolve) => setTimeout(resolve, IMAGES_TIMEOUT_MS)),
  ]);
}

export async function downloadReportPdf(
  root: HTMLElement,
  fileName: string,
): Promise<void> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
    waitForImages(root),
  ]);

  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(`[${PDF_BLOCK_ATTR}]`),
  );
  const targets = blocks.length > 0 ? blocks : [root];

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const contentWidth = PAGE.width - MARGIN * 2;
  const contentHeight = PAGE.height - MARGIN * 2;

  let cursor = MARGIN;
  let firstOnPage = true;

  /** Сколько блоков реально легло в файл: если ни один — файл не отдаём. */
  let placed = 0;

  for (const block of targets) {
    let canvas: HTMLCanvasElement;

    try {
      canvas = await html2canvas(block, {
        scale: SCALE,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        // Размер окна копии — от него зависят media-запросы и вся раскладка.
        windowWidth: CAPTURE_WIDTH,
        windowHeight: CAPTURE_HEIGHT,
        // Копию не прокручиваем: координаты блоков считаются от начала
        // документа и не зависят от того, где стоит страница у пары.
        scrollX: 0,
        scrollY: 0,
        ignoreElements: (element) => element.classList.contains("no-print"),
        onclone: (cloned) => {
          const style = cloned.createElement("style");
          style.textContent = CAPTURE_CSS;
          (cloned.head ?? cloned.documentElement).appendChild(style);
        },
      });
    } catch (error) {
      // Один упавший блок не должен стоить пары всего отчёта.
      console.error("[pdf] блок не снялся", error);
      continue;
    }

    if (canvas.width === 0 || canvas.height === 0) continue;

    const ratio = canvas.height / canvas.width;
    // Блок выше страницы (длинный баттл на узком экране) — уменьшаем по высоте,
    // иначе он уехал бы за край листа.
    const width = Math.min(contentWidth, contentHeight / ratio);
    const height = width * ratio;

    if (!firstOnPage && cursor + height > PAGE.height - MARGIN) {
      doc.addPage();
      cursor = MARGIN;
      firstOnPage = true;
    }

    doc.addImage(
      canvas.toDataURL("image/jpeg", QUALITY),
      "JPEG",
      MARGIN + (contentWidth - width) / 2,
      cursor,
      width,
      height,
    );

    cursor += height + GAP;
    firstOnPage = false;
    placed += 1;
  }

  // Пустой файл хуже окна печати: пусть вызывающий уйдёт в window.print().
  if (placed === 0) {
    throw new Error("pdf: не удалось снять ни один блок отчёта");
  }

  doc.save(fileName);
}
