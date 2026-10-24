// Browser-only extraction of text + embedded images from uploaded files.
// Module: POST /api/scan/document equivalent — text extraction with OCR fallback
// and image extraction (PDF / DOCX / images) for visual question generation.
import mammoth from "mammoth";

export type ExtractedImage = { dataUrl: string; width: number; height: number };
export type DocumentAssets = { text: string; images: ExtractedImage[] };

const MIN_IMAGE_PX = 150; // skip tiny icons/decorations
const MAX_IMAGES = 12;
const MAX_SIDE = 1200; // downscale for AI payload economy

// ---------- helpers ----------

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = dataUrl;
  });
}

/** Filter by min size + downscale to JPEG for upload/AI use. */
async function trimDataUrl(dataUrl: string, minPx = MIN_IMAGE_PX): Promise<ExtractedImage | null> {
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h || w < minPx || h < minPx) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Convert raw pdf.js image objects (ImageBitmap / 1bpp gray / RGB24 / RGBA32) to JPEG data URL. */
function pdfImageToDataUrl(img: any): Promise<ExtractedImage | null> {
  return new Promise((resolve) => {
    try {
      const width = img?.width;
      const height = img?.height;
      if (!width || !height) return resolve(null);
      const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (img.bitmap) {
        // pdf.js v4+ hands over decoded JPEG images as ImageBitmap
        ctx.drawImage(img.bitmap, 0, 0, canvas.width, canvas.height);
        return resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height });
      }

      const { data, kind } = img;
      if (!data) return resolve(null);
      const rgba = new Uint8ClampedArray(width * height * 4);
      if (kind === 1) {
        // RGB_24BPP
        for (let p = 0, i = 0; p < rgba.length; p += 4, i += 3) {
          rgba[p] = data[i];
          rgba[p + 1] = data[i + 1];
          rgba[p + 2] = data[i + 2];
          rgba[p + 3] = 255;
        }
      } else if (kind === 2) {
        // RGBA_32BPP
        rgba.set(data);
      } else if (kind === 0) {
        // GRAYSCALE_1BPP: bit 1 = white
        for (let p = 0, i = 0; i < data.length; i++) {
          const bits = data[i];
          for (let b = 7; b >= 0 && p < rgba.length; b--, p += 4) {
            const v = bits & (1 << b) ? 255 : 0;
            rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
            rgba[p + 3] = 255;
          }
        }
      } else {
        return resolve(null);
      }
      ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height });
    } catch {
      resolve(null);
    }
  });
}

// ---------- DOCX ----------

async function extractDocxAssets(buf: ArrayBuffer, minPx: number): Promise<DocumentAssets> {
  const [textRes, htmlRes] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer: buf }),
    mammoth.convertToHtml(
      { arrayBuffer: buf },
      {
        convertImage: mammoth.images.imgElement((image: any) =>
          image.readAsBase64String().then((b64: string) => ({ src: `data:${image.contentType};base64,${b64}` })),
        ),
      },
    ),
  ]);
  const images: ExtractedImage[] = [];
  try {
    const doc = new DOMParser().parseFromString(htmlRes.value, "text/html");
    const srcs = Array.from(doc.querySelectorAll("img"))
      .map((i) => i.getAttribute("src"))
      .filter((s): s is string => !!s && s.startsWith("data:"));
    for (const src of srcs) {
      if (images.length >= MAX_IMAGES) break;
      const trimmed = await trimDataUrl(src, minPx);
      if (trimmed) images.push(trimmed);
    }
  } catch {
    // images are optional
  }
  return { text: textRes.value, images };
}

// ---------- PDF ----------

async function extractPdfAssets(buf: ArrayBuffer, minPx: number): Promise<DocumentAssets> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  let text = "";
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();

  const getObj = (store: any, name: string) =>
    new Promise<any>((resolve) => {
      let done = false;
      const finish = (v: any) => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      try {
        const d = store.get(name, (v: any) => finish(v));
        if (d && (d.width || d.data)) finish(d);
      } catch {
        /* not in this store */
      }
      setTimeout(() => finish(undefined), 2000);
    });

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it: any) => it.str).join(" ") + "\n\n";
    if (images.length >= MAX_IMAGES) continue;

    try {
      const ops = await page.getOperatorList();
      for (let k = 0; k < ops.fnArray.length && images.length < MAX_IMAGES; k++) {
        const fn = ops.fnArray[k];
        if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
        const name = String(ops.argsArray[k][0]);
        if (seen.has(name)) continue;
        seen.add(name);
        const img = (await getObj(page.objs, name)) ?? (await getObj(page.commonObjs, name));
        if (!img) continue;
        const converted = await pdfImageToDataUrl(img);
        if (converted && converted.width >= minPx && converted.height >= minPx) images.push(converted);
      }
    } catch {
      // image extraction is best-effort; text is the priority
    }
  }
  return { text, images };
}

// ---------- public API ----------

export async function extractDocumentAssets(file: File, minImageSizePx = MIN_IMAGE_PX): Promise<DocumentAssets> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return { text: await file.text(), images: [] };
  }
  if (name.endsWith(".docx")) {
    return extractDocxAssets(await file.arrayBuffer(), minImageSizePx);
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfAssets(await file.arrayBuffer(), minImageSizePx);
  }
  if (file.type.startsWith("image/")) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const trimmed = await trimDataUrl(dataUrl, 50); // a full uploaded photo is the source itself
    return { text: "", images: trimmed ? [trimmed] : [] };
  }
  throw new Error("نوع الملف غير مدعوم");
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
