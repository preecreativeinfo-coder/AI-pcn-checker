import type { VercelRequest, VercelResponse } from "@vercel/node";

const DVSA_MOT_API_URL =
  "https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests";

// GET /api/vehicle/mot/:registration  — DVSA MOT History proxy (hides the API key)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const dvsaKey = process.env.DVSA_MOT_API_KEY;
  if (!dvsaKey) {
    res.status(503).json({
      error:
        "DVSA_MOT_API_KEY is not configured. Add it in the project environment variables to enable MOT history lookups.",
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
    const dvsaRes = await fetch(
      `${DVSA_MOT_API_URL}?registration=${encodeURIComponent(registration)}`,
      {
        headers: {
          "x-api-key": dvsaKey,
          Accept: "application/json+v6",
        },
      }
    );

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

    const vehicles = (await dvsaRes.json()) as Array<Record<string, unknown>>;
    const vehicle = Array.isArray(vehicles) ? vehicles[0] : vehicles;

    if (!vehicle) {
      res.status(404).json({ error: `No MOT records found for ${registration}` });
      return;
    }

    const rawTests = Array.isArray(vehicle.motTests)
      ? (vehicle.motTests as Array<Record<string, unknown>>)
      : [];
    const motTests = rawTests.map((t) => {
      const rawDefects = Array.isArray(t.rfrAndComments)
        ? (t.rfrAndComments as Array<Record<string, unknown>>)
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

    res.status(200).json({
      registration: vehicle.registration ?? registration,
      make: vehicle.make ?? null,
      model: vehicle.model ?? null,
      firstUsedDate: vehicle.firstUsedDate ?? null,
      fuelType: vehicle.fuelType ?? null,
      primaryColour: vehicle.primaryColour ?? null,
      motTests,
    });
  } catch (err) {
    console.error("DVSA MOT lookup failed", err);
    res.status(500).json({ error: "Failed to contact DVSA MOT API" });
  }
}
