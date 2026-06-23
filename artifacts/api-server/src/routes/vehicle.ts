import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DVLA_API_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const DVSA_MOT_API_URL =
  "https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests";

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
  const dvsaKey = process.env.DVSA_MOT_API_KEY;
  if (!dvsaKey) {
    res.status(503).json({
      error:
        "DVSA_MOT_API_KEY is not configured. Add it in Secrets to enable MOT history lookups.",
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
      const rawDefects = Array.isArray(t.rfrAndComments) ? t.rfrAndComments as Array<Record<string, unknown>> : [];
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
