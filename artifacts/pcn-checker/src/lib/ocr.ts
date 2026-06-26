import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { inferIssuerFromReference } from "@/lib/pcn-issuers";
// Vite resolves this to a hashed URL for the pdf.js worker bundle.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type Confidence = "high" | "medium" | "low";

export type ExtractField =
  | "pcnReference"
  | "issuer"
  | "issueDate"
  | "contraventionTime"
  | "contraventionCode"
  | "amount"
  | "dueDate"
  | "location"
  | "registration"
  | "make"
  | "model"
  | "colour"
  | "vehicleType";

export interface ExtractedFields {
  pcnReference: string | null;
  issuer: string | null;
  issueDate: string | null; // contravention / issue date (ISO yyyy-mm-dd)
  contraventionTime: string | null; // HH:MM
  contraventionCode: string | null;
  amount: number | null;
  dueDate: string | null;
  location: string | null;
  registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  vehicleType: string | null;
}

export interface OcrResult extends ExtractedFields {
  rawText: string;
  /** Overall OCR engine confidence 0–100, or null for text-based sources (PDF text / DOCX). */
  ocrConfidence: number | null;
  /** Per-field confidence for values that were found. */
  confidence: Partial<Record<ExtractField, Confidence>>;
}

export type OcrProgress = (stage: string, pct: number | null) => void;

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function isoFromMatch(raw: string): string | null {
  const dmy = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const named = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (named) {
    const mo = MONTHS[named[2].toLowerCase()];
    if (mo) return `${named[3]}-${mo}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

function normalisePlate(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

/**
 * Extract structured PCN + vehicle fields from raw text, with a per-field
 * confidence estimate. Labelled matches score "high"; generic/positional
 * fallbacks score "medium"/"low". Low overall OCR quality downgrades scores.
 */
function extractFields(text: string, ocrConfidence: number | null): {
  fields: ExtractedFields;
  confidence: Partial<Record<ExtractField, Confidence>>;
} {
  const confidence: Partial<Record<ExtractField, Confidence>> = {};
  const set = (k: ExtractField, c: Confidence) => (confidence[k] = c);

  // ── PCN reference ── (allow hyphen/slash separators; normalise them away)
  let pcnReference: string | null = null;
  const refToken = "([A-Z0-9][A-Z0-9\\-/]{4,17})";
  const refLabelled = [
    new RegExp(`PCN(?:\\s*(?:NO|NUMBER|REF|REFERENCE|#|:))?\\s*[:\\-]?\\s*${refToken}`, "i"),
    new RegExp(`PENALTY\\s+CHARGE\\s+NOTICE\\s+(?:NO\\.?|NUMBER|REF\\.?|REFERENCE)?\\s*[:\\-]?\\s*${refToken}`, "i"),
    new RegExp(`(?:NOTICE|CHARGE)\\s+(?:NO\\.?|NUMBER|REF(?:ERENCE)?)\\s*[:\\-]?\\s*${refToken}`, "i"),
    new RegExp(`(?:REFERENCE|REF)\\s*[:\\-#]?\\s*${refToken}`, "i"),
  ];
  for (const p of refLabelled) {
    const m = text.match(p);
    if (m) {
      pcnReference = m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
      set("pcnReference", "high");
      break;
    }
  }

  // ── Issuer ──
  let issuer: string | null = null;
  const issuerLabelled = [
    /ISSUED\s+BY\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
    /ISSUING\s+AUTHORITY\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
    /ON\s+BEHALF\s+OF\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
  ];
  for (const p of issuerLabelled) {
    const m = text.match(p);
    if (m) { issuer = m[1].trim().substring(0, 100); set("issuer", "high"); break; }
  }
  if (!issuer) {
    // Councils and well-known private parking operators by name anywhere in the text.
    const m = text.match(
      /([A-Z][A-Za-z.&'\s]+(?:COUNCIL|BOROUGH|DISTRICT|CITY COUNCIL|COUNTY COUNCIL|AUTHORITY)|TRANSPORT FOR LONDON|\bTFL\b|PARKING\s*EYE|EURO\s*CAR\s*PARKS|UK\s*PARKING\s*CONTROL|\bUKPC\b|HIGHVIEW\s*PARKING|SMART\s*PARKING|CIVIL\s*ENFORCEMENT|NATIONAL\s*CAR\s*PARKS|\bNCP\b)/i,
    );
    if (m) { issuer = m[1].trim().substring(0, 100); set("issuer", "medium"); }
  }
  if (!issuer) {
    // Last resort: infer from the reference number (low confidence).
    const inferred = inferIssuerFromReference(pcnReference);
    if (inferred) { issuer = inferred; set("issuer", "low"); }
  }

  // ── Dates (collect all for positional fallback) ──
  const allDates: Array<{ iso: string; pos: number }> = [];
  const dre = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  const mre = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi;
  let mm: RegExpExecArray | null;
  while ((mm = dre.exec(text)) !== null) {
    allDates.push({ iso: `${mm[3]}-${mm[2].padStart(2, "0")}-${mm[1].padStart(2, "0")}`, pos: mm.index });
  }
  while ((mm = mre.exec(text)) !== null) {
    const mo = MONTHS[mm[2].toLowerCase()];
    allDates.push({ iso: `${mm[3]}-${mo}-${mm[1].padStart(2, "0")}`, pos: mm.index });
  }
  allDates.sort((a, b) => a.pos - b.pos);

  const dateToken = "(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4}|\\d{1,2}\\s+\\w+\\s+\\d{4})";
  let issueDate: string | null = null;
  const issueLabelled = text.match(new RegExp(`(?:date\\s+(?:of\\s+)?(?:issue|contravention|offence)|contravention\\s+date|issued\\s+(?:on|date))\\s*[:\\-]?\\s*${dateToken}`, "i"));
  if (issueLabelled) { issueDate = isoFromMatch(issueLabelled[1]); if (issueDate) set("issueDate", "high"); }
  else if (allDates.length > 0) { issueDate = allDates[0].iso; set("issueDate", "low"); }

  let dueDate: string | null = null;
  const dueLabelled = text.match(new RegExp(`(?:pay(?:ment)?\\s+(?:by|before|due\\s+(?:by)?|deadline)|due\\s+(?:date|by))\\s*[:\\-]?\\s*${dateToken}`, "i"));
  if (dueLabelled) { dueDate = isoFromMatch(dueLabelled[1]); if (dueDate) set("dueDate", "high"); }
  else if (allDates.length > 1) { dueDate = allDates[1].iso; set("dueDate", "low"); }

  // ── Contravention time ──
  let contraventionTime: string | null = null;
  const timeLabelled = text.match(/(?:time\s+(?:of\s+)?(?:contravention|observation|issue)?|observed\s+at|at)\s*[:\-]?\s*([0-2]?\d:[0-5]\d)/i);
  if (timeLabelled) { contraventionTime = timeLabelled[1]; set("contraventionTime", "high"); }
  else {
    const t = text.match(/\b([0-2]?\d:[0-5]\d)\b/);
    if (t) { contraventionTime = t[1]; set("contraventionTime", "low"); }
  }

  // ── Contravention code ──
  let contraventionCode: string | null = null;
  const codeM = text.match(/CONTRAVENTION\s*(?:CODE|NO\.?|NUMBER)?\s*[:\-]?\s*(\d{1,3}[A-Za-z]?)/i);
  if (codeM) { contraventionCode = codeM[1]; set("contraventionCode", "high"); }

  // ── Amount ──
  let amount: number | null = null;
  const amtLabelled = text.match(/(?:penalty\s+charge|fine|amount\s+(?:due|payable)|total\s+(?:amount\s+)?(?:to\s+pay|due|payable)|balance(?:\s+due)?|charge)\s*[:\-]?\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
  if (amtLabelled) {
    const v = parseFloat(amtLabelled[1]);
    if (v > 0 && v < 10000) { amount = v; set("amount", "high"); }
  }
  if (amount === null) {
    const m = text.match(/£\s*(\d{2,4}(?:\.\d{1,2})?)/);
    if (m) { const v = parseFloat(m[1]); if (v > 0 && v < 10000) { amount = v; set("amount", "medium"); } }
  }

  // ── Location ──
  let location: string | null = null;
  const locLabelled = text.match(/(?:location|place\s+of\s+contravention|contravention\s+location|street|road)\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i);
  if (locLabelled) { location = locLabelled[1].trim().substring(0, 200); set("location", "high"); }
  else {
    const m = text.match(/(?:at|on)\s+([A-Z][A-Za-z0-9\s,]+(?:Street|Road|Avenue|Lane|Way|Drive|Close|Crescent|Square|Place|Gardens))/);
    if (m) { location = m[1].trim().substring(0, 200); set("location", "medium"); }
  }

  // ── Vehicle registration (VRM) ──
  let registration: string | null = null;
  const regLabelled = text.match(/(?:VEHICLE\s*(?:REG(?:ISTRATION)?)?(?:\s*(?:NO\.?|NUMBER|MARK|VRM))?|REG(?:ISTRATION)?\s*(?:NO\.?|MARK|NUMBER)?|VRM)\s*[:\-]?\s*([A-Z]{2}\d{2}\s?[A-Z]{3}|[A-Z]\d{1,3}\s?[A-Z]{3}|[A-Z]{3}\s?\d{1,3}[A-Z])/i);
  if (regLabelled) { registration = normalisePlate(regLabelled[1]); set("registration", "high"); }
  else {
    // Current-format UK plate anywhere in the text.
    const m = text.match(/\b([A-Z]{2}\d{2}\s?[A-Z]{3})\b/);
    if (m) { registration = normalisePlate(m[1]); set("registration", "medium"); }
  }

  // ── Make / Model / Colour / Vehicle type (labelled only) ──
  const grab = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim().replace(/\s{2,}/g, " ").substring(0, 30) : null;
  };
  const make = grab(/\bMAKE\s*[:\-]?\s*([A-Za-z][A-Za-z\- ]{1,19})/i);
  if (make) set("make", "high");
  const model = grab(/\bMODEL\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\- ]{0,19})/i);
  if (model) set("model", "high");
  const colour = grab(/\b(?:COLOUR|COLOR)\s*[:\-]?\s*([A-Za-z]{3,15})/i);
  if (colour) set("colour", "high");
  const vehicleType = grab(/\b(?:VEHICLE\s*TYPE|TYPE\s*OF\s*VEHICLE)\s*[:\-]?\s*([A-Za-z][A-Za-z ]{1,19})/i);
  if (vehicleType) set("vehicleType", "high");

  // Downgrade everything one notch if the OCR was poor.
  if (ocrConfidence !== null && ocrConfidence < 60) {
    for (const k of Object.keys(confidence) as ExtractField[]) {
      confidence[k] = confidence[k] === "high" ? "medium" : "low";
    }
  }

  return {
    fields: {
      pcnReference, issuer, issueDate, contraventionTime, contraventionCode,
      amount, dueDate, location, registration, make, model, colour, vehicleType,
    },
    confidence,
  };
}

async function ocrImage(
  image: Blob | HTMLCanvasElement,
  onProgress?: OcrProgress,
): Promise<{ text: string; confidence: number }> {
  const { data } = await Tesseract.recognize(image, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && m.status === "recognizing text") {
        onProgress("Reading text", Math.round(m.progress * 100));
      }
    },
  });
  return { text: data.text, confidence: data.confidence };
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
  }
  return text;
}

async function ocrPdfFirstPage(buffer: ArrayBuffer, onProgress?: OcrProgress): Promise<{ text: string; confidence: number }> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not get canvas context for PDF rendering");
  await page.render({ canvasContext: context, viewport }).promise;
  return ocrImage(canvas, onProgress);
}

function fileKind(file: File): "pdf" | "docx" | "doc" | "heic" | "image" | "unknown" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (name.endsWith(".doc") || file.type === "application/msword") return "doc";
  if (file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")) return "heic";
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/.test(name)) return "image";
  return "unknown";
}

/**
 * Run OCR / text extraction on an uploaded PCN file entirely in the browser.
 * Supports images (JPG/PNG/HEIC), PDFs (text layer or scanned), and DOCX.
 */
export async function runOcr(file: File, onProgress?: OcrProgress): Promise<OcrResult> {
  let rawText = "";
  let ocrConfidence: number | null = null;

  const kind = fileKind(file);

  if (kind === "doc") {
    throw new Error(
      "Legacy .doc files aren't supported for automatic extraction. Please upload a .docx, PDF or image, or enter details manually.",
    );
  }

  if (kind === "docx") {
    onProgress?.("Reading document", null);
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    rawText = value;
  } else if (kind === "pdf") {
    onProgress?.("Reading PDF", null);
    const buffer = await file.arrayBuffer();
    rawText = await extractPdfText(buffer);
    if (!rawText.trim()) {
      // Scanned PDF with no text layer — render page 1 and OCR it.
      const res = await ocrPdfFirstPage(await file.arrayBuffer(), onProgress);
      rawText = res.text;
      ocrConfidence = res.confidence;
    }
  } else if (kind === "heic") {
    onProgress?.("Converting image", null);
    const heic2any = (await import("heic2any")).default as (opts: { blob: Blob; toType?: string }) => Promise<Blob | Blob[]>;
    const converted = await heic2any({ blob: file, toType: "image/png" });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const res = await ocrImage(blob, onProgress);
    rawText = res.text;
    ocrConfidence = res.confidence;
  } else if (kind === "image") {
    const res = await ocrImage(file, onProgress);
    rawText = res.text;
    ocrConfidence = res.confidence;
  } else {
    throw new Error("Unsupported file type. Upload a JPG, PNG, HEIC, PDF or DOCX.");
  }

  onProgress?.("Extracting details", 100);
  const { fields, confidence } = extractFields(rawText, ocrConfidence);
  return { ...fields, rawText, ocrConfidence, confidence };
}
