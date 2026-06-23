import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a hashed URL for the pdf.js worker bundle.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface OcrResult {
  pcnReference: string | null;
  issuer: string | null;
  issueDate: string | null;
  amount: number | null;
  dueDate: string | null;
  location: string | null;
  rawText: string;
}

/**
 * Extract structured PCN fields from raw OCR/PDF text.
 * Ported verbatim from the former server-side OCR route so behaviour matches.
 */
function extractPcnFields(text: string): Omit<OcrResult, "rawText"> {
  // PCN Reference: typically alphanumeric, 6-14 chars
  let pcnReference: string | null = null;
  const refPatterns = [
    /PCN(?:\s*(?:NO|NUMBER|REF|REFERENCE|#|:))?\s*[:\-]?\s*([A-Z0-9]{6,14})/i,
    /PENALTY\s+CHARGE\s+NOTICE\s+(?:NO\.?|NUMBER|REF\.?|REFERENCE)?\s*[:\-]?\s*([A-Z0-9]{6,14})/i,
    /NOTICE\s+(?:NO\.?|NUMBER)?\s*[:\-]?\s*([A-Z0-9]{6,14})/i,
    /(?:REFERENCE|REF)\s*[:\-#]?\s*([A-Z0-9]{6,14})/i,
  ];
  for (const p of refPatterns) {
    const m = text.match(p);
    if (m) { pcnReference = m[1]; break; }
  }

  // Issuer: council or authority name
  let issuer: string | null = null;
  const issuerPatterns = [
    /ISSUED\s+BY\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
    /ISSUING\s+AUTHORITY\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
    /([A-Z\s]+(?:COUNCIL|BOROUGH|DISTRICT|CITY|COUNTY|AUTHORITY|TRANSPORT FOR LONDON|TFL))/i,
  ];
  for (const p of issuerPatterns) {
    const m = text.match(p);
    if (m) { issuer = m[1].trim().substring(0, 100); break; }
  }

  // Dates: UK format dd/mm/yyyy or dd-mm-yyyy or dd Month yyyy
  const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
  const monthPattern = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/gi;
  const monthNames: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const allDates: Array<{ raw: string; iso: string; pos: number }> = [];

  let m: RegExpExecArray | null;
  const re1 = new RegExp(datePattern.source, "g");
  while ((m = re1.exec(text)) !== null) {
    const [, d, mo, y] = m;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    allDates.push({ raw: m[0], iso, pos: m.index });
  }
  const re2 = new RegExp(monthPattern.source, "gi");
  while ((m = re2.exec(text)) !== null) {
    const [, d, monthStr, y] = m;
    const mo = monthNames[monthStr.toLowerCase()];
    const iso = `${y}-${mo}-${d.padStart(2, "0")}`;
    allDates.push({ raw: m[0], iso, pos: m.index });
  }
  allDates.sort((a, b) => a.pos - b.pos);

  let issueDate: string | null = null;
  let dueDate: string | null = null;

  const issueDateMatch = text.match(/(?:date\s+(?:of\s+)?(?:issue|contravention|offence)|issued\s+(?:on|date))\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}\s+\w+\s+\d{4})/i);
  const dueDateMatch = text.match(/(?:pay(?:ment)?\s+(?:by|before|due\s+(?:by)?|deadline)|due\s+(?:date|by))\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}\s+\w+\s+\d{4})/i);

  if (issueDateMatch) {
    const rawDate = issueDateMatch[1];
    const d2 = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const d3 = rawDate.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (d2) {
      issueDate = `${d2[3]}-${d2[2].padStart(2, "0")}-${d2[1].padStart(2, "0")}`;
    } else if (d3) {
      const mo = monthNames[d3[2].toLowerCase()];
      if (mo) issueDate = `${d3[3]}-${mo}-${d3[1].padStart(2, "0")}`;
    }
  } else if (allDates.length > 0) {
    issueDate = allDates[0].iso;
  }

  if (dueDateMatch) {
    const rawDate = dueDateMatch[1];
    const d2 = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const d3 = rawDate.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (d2) {
      dueDate = `${d2[3]}-${d2[2].padStart(2, "0")}-${d2[1].padStart(2, "0")}`;
    } else if (d3) {
      const mo = monthNames[d3[2].toLowerCase()];
      if (mo) dueDate = `${d3[3]}-${mo}-${d3[1].padStart(2, "0")}`;
    }
  } else if (allDates.length > 1) {
    dueDate = allDates[1].iso;
  }

  // Amount: look for £ symbol or keywords
  let amount: number | null = null;
  const amountPatterns = [
    /(?:penalty\s+charge|fine|amount\s+(?:due|payable)|charge)\s*[:\-]?\s*£\s*(\d+(?:\.\d{1,2})?)/i,
    /£\s*(\d{2,4}(?:\.\d{1,2})?)/,
    /(\d{2,4}(?:\.\d{2})?)\s*(?:GBP|gbp)/,
  ];
  for (const p of amountPatterns) {
    const match = text.match(p);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0 && val < 10000) {
        amount = val;
        break;
      }
    }
  }

  // Location
  let location: string | null = null;
  const locationPatterns = [
    /(?:location|place|street|road|avenue|lane|contravent(?:ion)?\s+(?:at|on|location))\s*[:\-]?\s*(.+?)(?:\r?\n|$)/i,
    /(?:at|on)\s+([A-Z][A-Za-z0-9\s,]+(?:Street|Road|Avenue|Lane|Way|Drive|Close|Crescent|Square|Place|Gardens))/i,
  ];
  for (const p of locationPatterns) {
    const match = text.match(p);
    if (match) { location = match[1].trim().substring(0, 200); break; }
  }

  return { pcnReference, issuer, issueDate, amount, dueDate, location };
}

async function ocrImage(image: Blob | HTMLCanvasElement): Promise<string> {
  const { data } = await Tesseract.recognize(image, "eng");
  return data.text;
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += pageText + "\n";
  }
  return text;
}

async function ocrPdfFirstPage(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not get canvas context for PDF rendering");
  await page.render({ canvasContext: context, viewport }).promise;
  return ocrImage(canvas);
}

/**
 * Run OCR on an uploaded PCN file entirely in the browser.
 * - Images: Tesseract.js
 * - PDFs: pdf.js text layer; falls back to rendering + Tesseract for scanned PDFs
 */
export async function runOcr(file: File): Promise<OcrResult> {
  let rawText = "";

  if (file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    rawText = await extractPdfText(buffer);
    if (!rawText.trim()) {
      // Scanned PDF with no text layer — render the first page and OCR it.
      rawText = await ocrPdfFirstPage(await file.arrayBuffer());
    }
  } else {
    rawText = await ocrImage(file);
  }

  return { ...extractPcnFields(rawText), rawText };
}
