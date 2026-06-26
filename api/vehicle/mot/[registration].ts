import type { VercelRequest, VercelResponse } from "@vercel/node";

// DVSA MOT History API (current version) — OAuth2 client-credentials + API key.
//   Token:    POST {DVSA_TOKEN_URL}  (grant_type=client_credentials, scope)
//   Data:     GET  {DVSA_MOT_API_URL}/{registration}  with Bearer token + X-API-Key
const DEFAULT_BASE = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";
const DEFAULT_SCOPE = "https://tapi.dvsa.gov.uk/.default";

// Cached across warm invocations of the same serverless instance.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.DVSA_CLIENT_ID!,
    client_secret: process.env.DVSA_CLIENT_SECRET!,
    scope: process.env.DVSA_SCOPE_URL || DEFAULT_SCOPE,
  });

  const res = await fetch(process.env.DVSA_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DVSA token request failed (HTTP ${res.status}) ${detail}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

function mapVehicle(vehicle: Record<string, unknown>, registration: string) {
  const rawTests = Array.isArray(vehicle.motTests)
    ? (vehicle.motTests as Array<Record<string, unknown>>)
    : [];
  const motTests = rawTests.map((t) => {
    // Current API uses `defects`; older payloads used `rfrAndComments`.
    const rawDefects = Array.isArray(t.defects)
      ? (t.defects as Array<Record<string, unknown>>)
      : Array.isArray(t.rfrAndComments)
        ? (t.rfrAndComments as Array<Record<string, unknown>>)
        : [];
    return {
      completedDate: t.completedDate ?? null,
      testResult: t.testResult ?? null,
      expiryDate: t.expiryDate ?? null,
      odometerValue: t.odometerValue !== undefined ? Number(t.odometerValue) : null,
      odometerUnit: t.odometerUnit ?? null,
      motTestNumber: t.motTestNumber ?? null,
      defects: rawDefects.map((d) => ({
        text: d.text ?? null,
        type: d.type ?? null,
        dangerous: d.dangerous ?? null,
      })),
    };
  });

  return {
    registration: vehicle.registration ?? registration,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    firstUsedDate: vehicle.firstUsedDate ?? null,
    fuelType: vehicle.fuelType ?? null,
    primaryColour: vehicle.primaryColour ?? null,
    motTests,
  };
}

// GET /api/vehicle/mot/:registration  — DVSA MOT History proxy (keeps creds server-side)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY, DVSA_TOKEN_URL } = process.env;
  if (!DVSA_CLIENT_ID || !DVSA_CLIENT_SECRET || !DVSA_API_KEY || !DVSA_TOKEN_URL) {
    res.status(503).json({
      error:
        "DVSA MOT API is not configured. Set DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY and DVSA_TOKEN_URL in the project environment variables.",
    });
    return;
  }

  const param = req.query.registration;
  const registration = (Array.isArray(param) ? param[0] : param ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!registration) {
    res.status(400).json({ error: "Registration number is required" });
    return;
  }

  try {
    const token = await getAccessToken();
    const base = process.env.DVSA_MOT_API_URL || DEFAULT_BASE;

    const dvsaRes = await fetch(`${base}/${encodeURIComponent(registration)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-API-Key": DVSA_API_KEY,
        Accept: "application/json",
      },
    });

    if (dvsaRes.status === 404) {
      res.status(404).json({ error: `No MOT records found for ${registration}` });
      return;
    }
    if (!dvsaRes.ok) {
      const errBody = await dvsaRes.text().catch(() => "");
      console.error("DVSA MOT API error", dvsaRes.status, errBody);
      res.status(502).json({ error: `DVSA API error (HTTP ${dvsaRes.status})` });
      return;
    }

    const data = (await dvsaRes.json()) as unknown;
    const vehicle = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!vehicle) {
      res.status(404).json({ error: `No MOT records found for ${registration}` });
      return;
    }

    res.status(200).json(mapVehicle(vehicle, registration));
  } catch (err) {
    console.error("DVSA MOT lookup failed", err);
    res.status(502).json({ error: "Failed to contact DVSA MOT API" });
  }
}
