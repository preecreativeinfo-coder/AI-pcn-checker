import { Router, type IRouter } from "express";

// POST /api/analyze — local-dev twin of the Vercel api/analyze.ts function.
// Calls the Claude API for an AI assessment of a PCN. Keeps the API key
// server-side (read from api-server/.env). Kept in sync with api/analyze.ts.

const router: IRouter = Router();

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANALYSIS_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an assistant that helps UK drivers understand a Penalty Charge Notice (PCN) for a parking or traffic contravention. You assess, in plain English, how strong a challenge/appeal might be based on the details provided and common, well-established grounds (e.g. unclear signage, grace periods, procedural errors, mitigating circumstances, charge amounts).

Important:
- You are NOT a solicitor and this is NOT legal advice. Frame everything as general information.
- Be balanced and realistic. Do not invent facts that were not provided.
- Base reasoning only on the details given; if key facts are missing, say so.

Respond with ONLY a JSON object (no markdown, no prose) matching exactly this shape:
{
  "likelihood": "low" | "moderate" | "high",
  "score": <integer 0-100>,
  "summary": "<2-3 sentence plain-English assessment>",
  "grounds": [ { "title": "<short ground>", "rationale": "<1-2 sentences>" } ],
  "recommendations": [ "<actionable next step>", ... ]
}`;

interface PcnInput {
  pcn_reference?: string;
  issuer?: string;
  issue_date?: string | null;
  due_date?: string | null;
  amount?: number | null;
  location?: string | null;
  contravention_code?: string | null;
  contravention_desc?: string | null;
  ocr_raw_text?: string | null;
}

function buildUserMessage(pcn: PcnInput): string {
  const lines = [
    `PCN reference: ${pcn.pcn_reference ?? "unknown"}`,
    `Issuer: ${pcn.issuer ?? "unknown"}`,
    `Issue date: ${pcn.issue_date ?? "unknown"}`,
    `Due date: ${pcn.due_date ?? "unknown"}`,
    `Amount: ${pcn.amount != null ? `£${pcn.amount}` : "unknown"}`,
    `Location: ${pcn.location ?? "unknown"}`,
    `Contravention code: ${pcn.contravention_code ?? "unknown"}`,
    `Alleged contravention: ${pcn.contravention_desc ?? "unknown"}`,
  ];
  if (pcn.ocr_raw_text) {
    lines.push(`\nText extracted from the notice:\n${pcn.ocr_raw_text.slice(0, 4000)}`);
  }
  return `Assess the following Penalty Charge Notice and return the JSON described.\n\n${lines.join("\n")}`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON in response");
  return JSON.parse(text.slice(start, end + 1));
}

router.post("/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error:
        "ANTHROPIC_API_KEY is not configured. Add it to api-server/.env to enable AI Analysis locally.",
    });
    return;
  }

  const pcn = (req.body ?? {}) as PcnInput;
  if (!pcn.issuer && !pcn.pcn_reference) {
    res.status(400).json({ error: "PCN details are required" });
    return;
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(pcn) }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("Anthropic error", upstream.status, detail);
      res.status(502).json({ error: `AI service error (HTTP ${upstream.status})` });
      return;
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const parsed = extractJson(text) as {
      likelihood?: string;
      score?: number;
      summary?: string;
      grounds?: { title: string; rationale: string }[];
      recommendations?: string[];
    };

    const likelihood =
      parsed.likelihood === "high" || parsed.likelihood === "moderate" || parsed.likelihood === "low"
        ? parsed.likelihood
        : "moderate";

    res.status(200).json({
      likelihood,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      summary: String(parsed.summary ?? "No summary available."),
      grounds: Array.isArray(parsed.grounds) ? parsed.grounds.slice(0, 8) : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 8)
        : [],
      generatedAt: new Date().toISOString(),
      model: MODEL,
    });
  } catch (err) {
    console.error("AI analysis failed", err);
    res.status(500).json({ error: "Failed to generate AI analysis" });
  }
});

export default router;
