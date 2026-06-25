import type { PCNStatus } from "@/hooks/use-pcns";

export const PCN_STATUSES: PCNStatus[] = [
  "pending",
  "contested",
  "appealed",
  "paid",
  "cancelled",
];

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "contested":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "appealed":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
