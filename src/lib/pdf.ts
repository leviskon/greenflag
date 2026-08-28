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
 * Плотность съёмки. 2 — примерно 144 dpi на A4: текст читается, файл остаётся
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

  for (const block of targets) {
    const canvas = await html2canvas(block, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      // Кнопки и точки карусели в файле не нужны.
      ignoreElements: (element) => element.classList.contains("no-print"),
      onclone: (cloned) => {
        // Слайды карусели лежат в ряду, сдвинутом трансформом: без этого в
        // файл попал бы только открытый слайд, да ещё и со смещением.
        cloned.querySelectorAll<HTMLElement>(".print-slides").forEach((row) => {
          row.style.transform = "none";
          row.style.display = "block";
        });
      },
    });

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
  }

  doc.save(fileName);
}
