import type { VercelRequest, VercelResponse } from "@vercel/node";

const DVLA_API_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

// POST /api/vehicle/lookup  — DVLA Vehicle Enquiry Service proxy (hides the API key)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const dvlaKey = process.env.DVLA_API_KEY;
  if (!dvlaKey) {
    res.status(503).json({
      error:
        "DVLA_API_KEY is not configured. Add it in the project environment variables to enable vehicle lookups.",
    });
    return;
  }

  const body = (req.body ?? {}) as { registrationNumber?: unknown };
  const raw = body.registrationNumber;
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
      const errBody = await dvlaRes.text().catch(() => "");
      console.error("DVLA API error", dvlaRes.status, errBody);
      res.status(502).json({ error: `DVLA API error (HTTP ${dvlaRes.status})` });
      return;
    }

    const data = (await dvlaRes.json()) as Record<string, unknown>;

    res.status(200).json({
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
    console.error("DVLA lookup failed", err);
    res.status(500).json({ error: "Failed to contact DVLA API" });
  }
}
