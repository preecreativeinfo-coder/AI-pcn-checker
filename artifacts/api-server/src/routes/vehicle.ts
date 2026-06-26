import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DVLA_API_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

// DVSA MOT History API (current) — OAuth2 client-credentials + API key.
const DVSA_DEFAULT_BASE =
  "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";
const DVSA_DEFAULT_SCOPE = "https://tapi.dvsa.gov.uk/.default";

let cachedDvsaToken: { value: string; expiresAt: number } | null = null;

async function getDvsaToken(): Promise<string> {
  const now = Date.now();
  if (cachedDvsaToken && cachedDvsaToken.expiresAt > now + 60_000) {
    return cachedDvsaToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.DVSA_CLIENT_ID!,
    client_secret: process.env.DVSA_CLIENT_SECRET!,
    scope: process.env.DVSA_SCOPE_URL || DVSA_DEFAULT_SCOPE,
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
  cachedDvsaToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedDvsaToken.value;
}

// ── POST /vehicle/lookup ──────────────────────────────────────────────────────
router.post("/vehicle/lookup", async (req, res): Promise<void> => {
  const dvlaKey = process.env.DVLA_API_KEY;
  if (!dvlaKey) {
    res.status(503).json({
      error:
        "DVLA_API_KEY is not configured. Add it in Secrets to enable vehicle lookups.",
    });
    return;
  }

  const raw: unknown = req.body?.registrationNumber;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    res.status(400).json({ error: "registrationNumber is required" });
    return;
  }

  const registration = raw.replace(/\s+/g, "").toUpperCase();

  try {
    const dvlaRes = await fetch(DVLA_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": dvlaKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registrationNumber: registration }),
    });

    if (dvlaRes.status === 404) {
      res
        .status(404)
        .json({ error: `No DVLA record found for registration ${registration}` });
      return;
    }

    if (!dvlaRes.ok) {
      const body = await dvlaRes.text().catch(() => "");
      req.log.error(
        { status: dvlaRes.status, body },
        "DVLA API returned an error"
      );
      res
        .status(502)
        .json({ error: `DVLA API error (HTTP ${dvlaRes.status})` });
      return;
    }

    const data = await dvlaRes.json() as Record<string, unknown>;

    res.json({
      registrationNumber: registration,
      make: data.make ?? null,
      colour: data.colour ?? null,
      yearOfManufacture: data.yearOfManufacture ?? null,
      engineCapacity: data.engineCapacity ?? null,
      fuelType: data.fuelType ?? null,
      taxStatus: data.taxStatus ?? null,
      taxDueDate: data.taxDueDate ?? null,
      motStatus: data.motStatus ?? null,
      motExpiryDate: data.motExpiryDate ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "DVLA lookup failed");
    res.status(500).json({ error: "Failed to contact DVLA API" });
  }
});

// ── GET /vehicle/mot/:registration ───────────────────────────────────────────
router.get("/vehicle/mot/:registration", async (req, res): Promise<void> => {
  const { DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY, DVSA_TOKEN_URL } = process.env;
  if (!DVSA_CLIENT_ID || !DVSA_CLIENT_SECRET || !DVSA_API_KEY || !DVSA_TOKEN_URL) {
    res.status(503).json({
      error:
        "DVSA MOT API is not configured. Set DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_API_KEY and DVSA_TOKEN_URL.",
    });
    return;
  }

  const registration = (req.params.registration ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!registration) {
    res.status(400).json({ error: "Registration number is required" });
    return;
  }

  try {
    const token = await getDvsaToken();
    const base = process.env.DVSA_MOT_API_URL || DVSA_DEFAULT_BASE;
    const dvsaRes = await fetch(
      `${base}/${encodeURIComponent(registration)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-API-Key": DVSA_API_KEY,
          Accept: "application/json",
        },
      }
    );

    if (dvsaRes.status === 404) {
      res
        .status(404)
        .json({ error: `No MOT records found for ${registration}` });
      return;
    }

    if (!dvsaRes.ok) {
      const body = await dvsaRes.text().catch(() => "");
      req.log.error(
        { status: dvsaRes.status, body },
        "DVSA MOT API returned an error"
      );
      res
        .status(502)
        .json({ error: `DVSA API error (HTTP ${dvsaRes.status})` });
      return;
    }

    const vehicles = (await dvsaRes.json()) as Array<Record<string, unknown>>;
    const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles;

    if (!vehicle) {
      res.status(404).json({ error: `No MOT records found for ${registration}` });
      return;
    }

    const rawTests = Array.isArray(vehicle.motTests) ? vehicle.motTests as Array<Record<string, unknown>> : [];
    const motTests = rawTests.map((t) => {
      const rawDefects = Array.isArray(t.defects)
        ? t.defects as Array<Record<string, unknown>>
        : Array.isArray(t.rfrAndComments)
          ? t.rfrAndComments as Array<Record<string, unknown>>
          : [];
      return {
        completedDate: t.completedDate ?? null,
        testResult: t.testResult ?? null,
        expiryDate: t.expiryDate ?? null,
        odometerValue:
          t.odometerValue !== undefined ? Number(t.odometerValue) : null,
        odometerUnit: t.odometerUnit ?? null,
        motTestNumber: t.motTestNumber ?? null,
        defects: rawDefects.map((d) => ({
          text: d.text ?? null,
          type: d.type ?? null,
          dangerous: d.dangerous ?? null,
        })),
      };
    });

    res.json({
      registration: vehicle.registration ?? registration,
      make: vehicle.make ?? null,
      model: vehicle.model ?? null,
      firstUsedDate: vehicle.firstUsedDate ?? null,
      fuelType: vehicle.fuelType ?? null,
      primaryColour: vehicle.primaryColour ?? null,
      motTests,
    });
  } catch (err) {
    req.log.error({ err }, "DVSA MOT lookup failed");
    res.status(500).json({ error: "Failed to contact DVSA MOT API" });
  }
});

export default router;
