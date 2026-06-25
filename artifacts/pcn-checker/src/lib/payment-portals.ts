// Maps a PCN issuer to its online payment portal. Falls back to the gov.uk
// "pay a parking ticket" finder when we don't have a specific URL on file.

const PORTALS: { match: RegExp; url: string }[] = [
  { match: /islington/i, url: "https://www.islington.gov.uk/roads/parking/parking-tickets-pcns" },
  { match: /camden/i, url: "https://www.camden.gov.uk/pay-a-penalty-charge-notice" },
  { match: /westminster/i, url: "https://www.westminster.gov.uk/parking/parking-fines-and-penalty-charge-notices" },
  { match: /lambeth/i, url: "https://www.lambeth.gov.uk/parking-transport-and-streets/parking-fines" },
  { match: /hackney/i, url: "https://hackney.gov.uk/pay-pcn" },
  { match: /transport for london|^tfl|\btfl\b/i, url: "https://tfl.gov.uk/modes/driving/red-routes/penalty-charge-notices" },
];

const FALLBACK = "https://www.gov.uk/pay-parking-ticket";

export function paymentPortal(issuer: string | null | undefined): { url: string; known: boolean } {
  if (issuer) {
    for (const p of PORTALS) {
      if (p.match.test(issuer)) return { url: p.url, known: true };
    }
  }
  return { url: FALLBACK, known: false };
}
