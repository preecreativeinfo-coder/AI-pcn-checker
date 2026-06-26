// Best-effort issuer inference from a PCN reference number.
//
// There is NO public registry that maps PCN numbers to authorities, and the
// format differs by council and operator. So this is deliberately conservative:
// it only matches a few distinctive, defensible cases and otherwise returns
// null — we never name a specific council we can't justify. Anything inferred
// here is surfaced in the UI as LOW confidence for the user to confirm.
//
// Extend PATTERNS as you confirm the formats your own councils/operators use.

const PATTERNS: { test: RegExp; issuer: string }[] = [
  // Private parking operators frequently embed their identity in the reference.
  { test: /PARKINGEYE/i, issuer: "ParkingEye" },
  { test: /EUROCARPARKS|^ECP/i, issuer: "Euro Car Parks" },
  { test: /UKPC|UKPARKINGCONTROL/i, issuer: "UK Parking Control" },
  { test: /HIGHVIEW/i, issuer: "Highview Parking" },
  { test: /SMARTPARKING/i, issuer: "Smart Parking" },
  { test: /\bNCP\b|NATIONALCARPARKS/i, issuer: "National Car Parks" },
];

/** Returns a best-effort issuer for a PCN reference, or null if we can't be sure. */
export function inferIssuerFromReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const clean = ref.replace(/\s+/g, "").toUpperCase();
  for (const p of PATTERNS) {
    if (p.test.test(clean)) return p.issuer;
  }
  return null;
}
