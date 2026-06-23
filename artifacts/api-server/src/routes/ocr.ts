import { Router, type IRouter } from "express";
import { createWorker } from "tesseract.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require("pdf-parse");
import { ProcessOcrBody, ProcessOcrResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function extractPcnFields(text: string): {
  pcnReference: string | null;
  issuer: string | null;
  issueDate: string | null;
  amount: number | null;
  dueDate: string | null;
  location: string | null;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const fullText = text.toUpperCase();

  // PCN Reference: typically alphanumeric, 8-14 chars
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

router.post("/ocr/process", async (req, res): Promise<void> => {
  const parsed = ProcessOcrBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fileData, mimeType } = parsed.data;

  let rawText = "";

  try {
    if (mimeType === "application/pdf") {
      // PDF: extract text directly
      const buffer = Buffer.from(fileData, "base64");
      const data = await pdfParse(buffer);
      rawText = data.text;
    } else {
      // Image: use Tesseract OCR
      const buffer = Buffer.from(fileData, "base64");
      const worker = await createWorker("eng");
      try {
        const result = await worker.recognize(buffer);
        rawText = result.data.text;
      } finally {
        await worker.terminate();
      }
    }

    const fields = extractPcnFields(rawText);

    const response = ProcessOcrResponse.parse({
      ...fields,
      rawText,
    });

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "OCR processing failed");
    res.status(500).json({ error: "OCR processing failed" });
  }
});

export default router;
