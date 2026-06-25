import { Link } from "wouter";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicles } from "@/hooks/use-vehicles";
import { Skeleton } from "@/components/ui/skeleton";

/** Render a UK plate-style registration with a space before the last 3 chars. */
function formatPlate(reg: string): string {
  const clean = reg.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, clean.length - 3)} ${clean.slice(-3)}`;
}

export function VehiclesStrip() {
  const { data: vehicles, isLoading } = useVehicles();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">My Vehicles</CardTitle>
        <Link href="/vehicles" className="text-sm font-medium text-primary hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(vehicles ?? []).map((v) => (
              <Link
                key={v.id}
                href="/vehicles"
                className="rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="font-mono text-base font-bold tracking-wide">{formatPlate(v.registration_number)}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                </div>
              </Link>
            ))}
            <Link
              href="/vehicles"
              className="flex min-h-20 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add vehicle
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
