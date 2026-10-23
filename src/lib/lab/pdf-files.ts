// PDF Pages in the browser: opening the dropped PDFs, drawing their pages, and writing the new files. Both packages
// load only when the first PDF is dropped: pdf-lib (@cantoo's kept-up fork) reads and writes PDFs, pdf.js draws pages.
// Which pages go where is worked out in pdf-pages.js.
import type { PDFDocument as Doc } from '@cantoo/pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { zipFiles } from './convert-image.js';

const libs = () => Promise.all([
  import('@cantoo/pdf-lib'),
  import('pdfjs-dist').then(async (pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    return pdfjs;
  }),
]);
let loading: ReturnType<typeof libs> | null = null;
const load = () => (loading ??= libs());

export type Opened = {
  doc: Doc;
  view: PDFDocumentProxy;
  /** Each page's shape as it shows (its own turn counted): width over height. */
  shapes: number[];
};

/**
 * A dropped PDF, opened, or why it can't be: a password needed to open it, or not a PDF this page can read. A PDF
 * that only limits what may be changed opens with an empty password, as it does in a viewer.
 */
export async function openPdf(file: File): Promise<Opened | { error: 'password' | 'broken' }> {
  const [{ PDFDocument }, pdfjs] = await load();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc: Doc;
  let shapes: number[];
  try {
    doc = await PDFDocument.load(bytes, { password: '', updateMetadata: false });
    shapes = doc.getPages().map((page) => {
      const { width, height } = page.getSize();
      return page.getRotation().angle % 180 ? height / width : width / height;
    });
  } catch (e) {
    return { error: /password|encrypt/i.test(String((e as Error)?.message ?? e)) ? 'password' : 'broken' };
  }
  if (!shapes.length) return { error: 'broken' };
  let view: PDFDocumentProxy;
  try {
    // pdf.js takes its copy over to its worker, which empties the one it's given.
    view = await pdfjs.getDocument({ data: bytes.slice(), password: '', isEvalSupported: false }).promise;
  } catch (e) {
    return { error: (e as Error)?.name === 'PasswordException' ? 'password' : 'broken' };
  }
  return { doc, view, shapes };
}

/** The longest side of a page's picture on the board, in pixels: sharp at twice the preview's size. */
const THUMB = 360;
/** A saved picture's scale (2 is 144 dots an inch) and its longest side at most, which browsers can draw. */
const PICTURE_SCALE = 2;
const PICTURE_MAX = 4000;

// One page is drawn at a time: tidying up after one drawing can cut off another running on the same PDF, and a
// long board would otherwise start dozens at once.
let queue: Promise<unknown> = Promise.resolve();
const draw = (view: PDFDocumentProxy, n: number, size: (w: number, h: number) => number, turn = 0) => {
  const next = queue.then(() => drawNow(view, n, size, turn));
  queue = next.catch(() => {});
  return next;
};

/** A page drawn into a canvas, white behind it, turned by `turn` more than its own turn. */
async function drawNow(view: PDFDocumentProxy, n: number, size: (w: number, h: number) => number, turn: number) {
  // shortcut: pdf.js 5.4 keeps one page count for every open PDF, the last one opened's, and turns away page 5 of
  // a 5-page PDF when a 4-page one was opened after it; so each drawing sets it to its own PDF's first (they run one
  // at a time). Drop this when a pdf.js that keeps it per PDF can be used here (the newer ones need Node 22).
  (await load())[1].PagesMapper.instance.pagesNumber = view.numPages;
  const page = await view.getPage(n);
  const plain = page.getViewport({ scale: 1, rotation: (page.rotate + turn) % 360 });
  const viewport = page.getViewport({ scale: size(plain.width, plain.height), rotation: (page.rotate + turn) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Drawn as for printing: drawing for the screen waits on animation frames, which stop in a tab in the background,
  // so a save left running there would never finish.
  await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' }).promise;
  page.cleanup();
  return canvas;
}

const blobOf = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('too big'))), type, quality));

/** A small picture of page `n` (from 1) for the board, as an address an image can show. */
export async function thumbnail(opened: Opened, n: number) {
  const canvas = await draw(opened.view, n, (w, h) => THUMB / Math.max(w, h));
  return URL.createObjectURL(await blobOf(canvas, 'image/jpeg', 0.85));
}

export type Planned = { name: string; kind: 'pdf' | 'jpg' | 'png'; pages: { file: string; n: number; turn: number }[] };

/** The bytes of one planned file: a PDF of copied pages, each turned, or a picture of one page. */
async function makeFile(plan: Planned, opened: Map<string, Opened>): Promise<Uint8Array> {
  if (plan.kind !== 'pdf') {
    const { file, n, turn } = plan.pages[0];
    const canvas = await draw(opened.get(file)!.view, n, (w, h) => Math.min(PICTURE_SCALE, PICTURE_MAX / Math.max(w, h)), turn);
    const blob = await blobOf(canvas, plan.kind === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
    return new Uint8Array(await blob.arrayBuffer());
  }
  const [{ PDFDocument, degrees }] = await load();
  const out = await PDFDocument.create();
  for (const { file, n, turn } of plan.pages) {
    const [page] = await out.copyPages(opened.get(file)!.doc, [n - 1]);
    page.setRotation(degrees((page.getRotation().angle + turn) % 360));
    out.addPage(page);
  }
  return out.save();
}

const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };

/** Makes what a Save planned and hands it to the browser to download: one file as it is, several in a ZIP. */
export async function saveAll(planned: { zip: string | null; files: Planned[] }, opened: Map<string, Opened>) {
  const made = [];
  for (const plan of planned.files) made.push({ name: plan.name, bytes: await makeFile(plan, opened) });
  const blob = planned.zip
    ? new Blob([zipFiles(made)], { type: 'application/zip' })
    : new Blob([made[0].bytes as BlobPart], { type: TYPES[planned.files[0].kind] });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = planned.zip ?? planned.files[0].name;
  document.body.append(link);
  link.click();
  link.remove();
  // The download has its copy once it starts; a minute is plenty.
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  return { name: link.download, size: blob.size };
}
