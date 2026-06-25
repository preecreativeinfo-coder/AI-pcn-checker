// Common UK civil parking contravention codes (TMA 2004 / national code list).
// Not exhaustive — covers the codes drivers most commonly see. Used to show a
// human-readable "Alleged Contravention" from a stored contravention code.

const CONTRAVENTION_CODES: Record<string, string> = {
  "01": "Parked in a restricted street during prescribed hours",
  "02": "Parked or loading/unloading in a restricted street where waiting and loading restrictions are in force",
  "04": "Parked in a meter bay when penalty time was indicated",
  "05": "Parked after the expiry of paid-for time",
  "06": "Parked without clearly displaying a valid pay & display ticket or voucher",
  "07": "Parked with payment made to extend the stay beyond the initial time",
  "11": "Parked without payment of the parking charge",
  "12": "Parked in a residents' or shared-use bay without a valid permit",
  "14": "Parked in an electric vehicle charging place during restricted hours without charging",
  "16": "Parked in a permit space without displaying a valid permit",
  "19": "Parked in a residents' or shared-use bay displaying an invalid permit",
  "21": "Parked in a suspended bay or space or part of bay",
  "22": "Re-parked in the same parking place within one hour of leaving",
  "23": "Parked in a parking place not designated for that class of vehicle",
  "24": "Not parked correctly within the markings of the bay or space",
  "25": "Parked in a loading place or bay during restricted hours without loading",
  "26": "Parked more than 50cm from the edge of the carriageway and not within a designated space",
  "27": "Parked adjacent to a dropped footway",
  "30": "Parked for longer than permitted",
  "40": "Parked in a designated disabled person's parking place without displaying a valid Blue Badge",
  "45": "Parked on a taxi rank",
  "46": "Stopped where prohibited (on a red route or clearway)",
  "47": "Stopped on a restricted bus stop or stand",
  "48": "Stopped in a restricted area outside a school",
  "62": "Parked with one or more wheels on a footway, verge or land between two carriageways",
  "99": "Stopped on a pedestrian crossing or crossing area marked by zig-zags",
};

/** Normalise an entered code (strip spaces, pad single digit to 2). */
function normalise(code: string): string {
  const trimmed = code.trim().replace(/\s+/g, "");
  return /^\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
}

/** Returns the description for a contravention code, or null if unknown. */
export function contraventionDescription(code: string | null | undefined): string | null {
  if (!code) return null;
  return CONTRAVENTION_CODES[normalise(code)] ?? null;
}
