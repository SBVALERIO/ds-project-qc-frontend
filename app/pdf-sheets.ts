"use client";

// Renders every page of a Project Package PDF to a JPEG in the browser and
// stores it on the timeline event, so the "Pranchas" tab can show the sheet
// with the QC findings pinned on it. pdf.js is loaded from cdnjs on demand
// (only when a PDF is attached), so it adds nothing to the normal page load.

const PDFJS_VERSION = "4.4.168";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
const TARGET_WIDTH = 2200; // px — enough to read sheet text when zoomed
const JPEG_QUALITY = 0.72;

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage(n: number): Promise<PdfPage> };
type PdfPage = {
  getViewport(o: { scale: number }): { width: number; height: number; transform: number[] };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: { str: string; transform: number[] }[] }>;
};

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ PDFJS_URL).then((mod: PdfJs) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return mod;
    });
  }
  return pdfjsPromise;
}

const SHEET_NUMBER = /\b[A-Z]{1,2}-\d{3}(?:\.\d{1,2}|\.?[A-Z])?\b/g;

async function sheetLabel(page: PdfPage, viewport: { width: number; transform: number[] }): Promise<string> {
  // The DS title block sits on the right edge; its sheet number is the last
  // "I-106.A"-style code there (the index sheet lists many, so prefer the strip).
  const text = await page.getTextContent();
  const strip: string[] = [];
  const all: string[] = [];
  for (const item of text.items) {
    const [a, b, c, d, e, f] = viewport.transform;
    const x = a * item.transform[4] + c * item.transform[5] + e;
    void b; void d; void f;
    all.push(item.str);
    if (x > viewport.width * 0.84) strip.push(item.str);
  }
  const fromStrip = strip.join(" ").match(SHEET_NUMBER);
  if (fromStrip?.length) return fromStrip[fromStrip.length - 1];
  const any = all.join(" ").match(SHEET_NUMBER);
  return any?.length ? any[any.length - 1] : "";
}

export async function uploadPdfSheets(
  file: File,
  eventId: string,
  projectId: string,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let saved = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(n - 1, doc.numPages);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const data = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];
    const label = await sheetLabel(page, viewport);
    const response = await fetch("/api/sheets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, projectId, pageNumber: n, label, width: canvas.width, height: canvas.height, data }),
    });
    if (response.ok) saved++;
    canvas.width = 0;
    canvas.height = 0;
  }
  onProgress(doc.numPages, doc.numPages);
  return saved;
}
