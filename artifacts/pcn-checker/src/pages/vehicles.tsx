import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileCheck,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVehicles, useCreateVehicle, useDeleteVehicle } from "@/hooks/use-vehicles";
import {
  useLookupVehicle,
  useGetMotHistory,
  getGetMotHistoryQueryKey,
} from "@workspace/api-client-react";
import type { VehicleLookupResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

// In dev the lookups go through the local Express server; in prod they're
// same-origin Vercel functions (mirrors the base-URL logic in main.tsx).
const API_BASE = import.meta.env.DEV ? "http://localhost:3001" : "";

interface MotSummary {
  expiry: string | null;
  result: string | null;
}

/** Pick the most recent MOT test to surface its expiry + result on the card. */
function latestMot(motTests: Array<{ completedDate?: string; expiryDate?: string; testResult?: string }> | undefined): MotSummary {
  if (!Array.isArray(motTests) || motTests.length === 0) return { expiry: null, result: null };
  const latest = [...motTests].sort(
    (a, b) => new Date(b.completedDate ?? 0).getTime() - new Date(a.completedDate ?? 0).getTime(),
  )[0];
  return { expiry: latest?.expiryDate ?? null, result: latest?.testResult ?? null };
}

const vehicleSchema = z.object({
  registration_number: z.string().min(1, "Registration number is required").toUpperCase(),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

function taxBadge(status: string | null | undefined) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "taxed")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 border text-xs font-medium">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Taxed
      </Badge>
    );
  if (s === "sorn")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 border text-xs font-medium">
        <AlertCircle className="h-3 w-3 mr-1" /> SORN
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-800 border-red-200 border text-xs font-medium">
      <XCircle className="h-3 w-3 mr-1" /> {status}
    </Badge>
  );
}

function motBadge(status: string | null | undefined) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "valid")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 border text-xs font-medium">
        <CheckCircle2 className="h-3 w-3 mr-1" /> MOT Valid
      </Badge>
    );
  if (s.includes("no details"))
    return (
      <Badge className="bg-muted text-muted-foreground border text-xs font-medium">
        <AlertCircle className="h-3 w-3 mr-1" /> No MOT data
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-800 border-red-200 border text-xs font-medium">
      <XCircle className="h-3 w-3 mr-1" /> MOT {status}
    </Badge>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return dateStr;
  }
}

function DvlaInfoPanel({ data }: { data: VehicleLookupResult }) {
  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        DVLA Government Records
      </p>
      <div className="flex flex-wrap gap-2">
        {taxBadge(data.taxStatus)}
        {motBadge(data.motStatus)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {data.colour && (
          <>
            <span className="text-muted-foreground text-xs">Colour</span>
            <span className="text-xs capitalize">{data.colour.toLowerCase()}</span>
          </>
        )}
        {data.yearOfManufacture && (
          <>
            <span className="text-muted-foreground text-xs">Year</span>
            <span className="text-xs">{data.yearOfManufacture}</span>
          </>
        )}
        {data.fuelType && (
          <>
            <span className="text-muted-foreground text-xs">Fuel</span>
            <span className="text-xs capitalize">{data.fuelType.toLowerCase()}</span>
          </>
        )}
        {data.engineCapacity && (
          <>
            <span className="text-muted-foreground text-xs">Engine</span>
            <span className="text-xs">{data.engineCapacity}cc</span>
          </>
        )}
        {data.taxDueDate && (
          <>
            <span className="text-muted-foreground text-xs">Tax expires</span>
            <span className="text-xs">{formatDate(data.taxDueDate)}</span>
          </>
        )}
        {data.motExpiryDate && (
          <>
            <span className="text-muted-foreground text-xs">MOT expires</span>
            <span className="text-xs">{formatDate(data.motExpiryDate)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function MotHistoryDialog({
  registration,
  open,
  onClose,
}: {
  registration: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useGetMotHistory(registration, {
    query: {
      enabled: open && !!registration,
      queryKey: getGetMotHistoryQueryKey(registration),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            MOT History — {registration}
          </DialogTitle>
          <DialogDescription className="text-xs">
            DVSA MOT test records. Source: UK Government DVSA database.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading MOT history from DVSA…</span>
              </div>
            )}
            {isError && (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                {(error as any)?.message?.includes("503") ||
                (error as any)?.message?.includes("not configured") ? (
                  <p>
                    DVSA API key not configured. Add{" "}
                    <code className="bg-muted px-1 rounded">DVSA_MOT_API_KEY</code>{" "}
                    in Secrets to enable MOT history.
                  </p>
                ) : (
                  <p>No MOT records found for {registration}.</p>
                )}
              </div>
            )}
            {data && (
              <>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {data.make} {data.model}
                  </span>
                  {data.primaryColour && (
                    <span> · {data.primaryColour.toLowerCase()}</span>
                  )}
                  {data.fuelType && (
                    <span> · {data.fuelType.toLowerCase()}</span>
                  )}
                </div>
                {!data.motTests?.length ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                    No MOT tests on record.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.motTests.map((test, idx) => {
                      const passed = test.testResult === "PASSED";
                      const advisories =
                        test.defects?.filter(
                          (d) => d.type === "ADVISORY" || d.type === "MINOR"
                        ) ?? [];
                      const failures =
                        test.defects?.filter(
                          (d) =>
                            d.type === "MAJOR" ||
                            d.type === "DANGEROUS" ||
                            d.type === "FAIL"
                        ) ?? [];

                      return (
                        <div
                          key={idx}
                          className={`rounded-lg border p-4 ${
                            passed
                              ? "border-green-200 bg-green-50/50"
                              : "border-red-200 bg-red-50/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                {passed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                )}
                                <span
                                  className={`font-semibold text-sm ${
                                    passed ? "text-green-700" : "text-red-700"
                                  }`}
                                >
                                  {passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDate(test.completedDate)}
                                {test.expiryDate && (
                                  <span> · Expires {formatDate(test.expiryDate)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {test.odometerValue && (
                                <div>
                                  {test.odometerValue.toLocaleString()}{" "}
                                  {test.odometerUnit}
                                </div>
                              )}
                              {test.motTestNumber && (
                                <div className="font-mono">{test.motTestNumber}</div>
                              )}
                            </div>
                          </div>

                          {failures.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-xs font-semibold text-red-700">
                                Failures ({failures.length})
                              </p>
                              {failures.map((d, di) => (
                                <p key={di} className="text-xs text-red-800 pl-3 border-l-2 border-red-300">
                                  {d.text}
                                </p>
                              ))}
                            </div>
                          )}

                          {advisories.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-xs font-semibold text-amber-700">
                                Advisories ({advisories.length})
                              </p>
                              {advisories.slice(0, 3).map((d, di) => (
                                <p key={di} className="text-xs text-amber-800 pl-3 border-l-2 border-amber-300">
                                  {d.text}
                                </p>
                              ))}
                              {advisories.length > 3 && (
                                <p className="text-xs text-muted-foreground pl-3">
                                  +{advisories.length - 3} more…
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Source: DVSA MOT History API ·{" "}
                  <a
                    href={`https://www.check-mot.service.gov.uk/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Check on GOV.UK <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function VehiclesPage() {
  const { data: vehicles, isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const lookupVehicle = useLookupVehicle();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dvlaPreview, setDvlaPreview] = useState<VehicleLookupResult | null>(null);
  const [cardDvlaData, setCardDvlaData] = useState<Record<string, VehicleLookupResult>>({});
  const [cardMot, setCardMot] = useState<Record<string, MotSummary>>({});
  const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({});
  const [cardError, setCardError] = useState<Record<string, boolean>>({});
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [motDialogReg, setMotDialogReg] = useState<string | null>(null);
  const autoTried = useRef<Set<string>>(new Set());

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      registration_number: "",
      make: "",
      model: "",
    },
  });

  const handleAutoFill = async () => {
    const reg = form.getValues("registration_number");
    if (!reg) {
      toast({
        variant: "destructive",
        title: "Enter a registration first",
        description: "Type the registration number before looking it up.",
      });
      return;
    }
    try {
      const result = await lookupVehicle.mutateAsync({
        data: { registrationNumber: reg },
      });
      setDvlaPreview(result);
      if (result.make) {
        form.setValue("make", result.make, { shouldValidate: true });
      }
      toast({
        title: "Auto-filled from DVLA",
        description: `Found: ${result.make ?? "unknown make"} · ${result.colour ?? ""} · ${result.yearOfManufacture ?? ""}`,
      });
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("503") || msg.includes("not configured")) {
        toast({
          variant: "destructive",
          title: "DVLA API key missing",
          description: "Add DVLA_API_KEY in Secrets to enable auto-fill.",
        });
      } else if (msg.includes("404") || msg.includes("not found")) {
        toast({
          variant: "destructive",
          title: "Vehicle not found",
          description: `No DVLA record for "${reg.toUpperCase()}". Check the registration and try again.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "DVLA lookup failed",
          description: "Could not reach DVLA. Try again later.",
        });
      }
    }
  };

  const handleCardLookup = async (vehicleId: string, reg: string) => {
    setCardLoading((prev) => ({ ...prev, [vehicleId]: true }));
    try {
      const result = await lookupVehicle.mutateAsync({
        data: { registrationNumber: reg },
      });
      setCardDvlaData((prev) => ({ ...prev, [vehicleId]: result }));
      setExpandedCard(vehicleId);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("503") || msg.includes("not configured")) {
        toast({
          variant: "destructive",
          title: "DVLA API key missing",
          description: "Add DVLA_API_KEY in Secrets to enable vehicle lookups.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Lookup failed",
          description: "Could not fetch DVLA data. Try again later.",
        });
      }
    } finally {
      setCardLoading((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const onSubmit = async (values: VehicleFormValues) => {
    try {
      await createVehicle.mutateAsync(values);
      toast({
        title: "Vehicle added",
        description: `${values.registration_number} has been saved.`,
      });
      setIsCreateOpen(false);
      setDvlaPreview(null);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add vehicle",
        description: error.message || "An error occurred.",
      });
    }
  };

  const handleDelete = async (id: string, reg: string) => {
    try {
      await deleteVehicle.mutateAsync(id);
      toast({ title: "Vehicle removed", description: `${reg} removed.` });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to remove vehicle",
        description: error.message || "An error occurred.",
      });
    }
  };

  // Auto-fetch DVLA details for each vehicle once, so MOT/Tax show without a
  // manual click. Silent — no toasts; a missing key just flags "unavailable".
  useEffect(() => {
    if (!vehicles) return;
    vehicles.forEach((v) => {
      if (autoTried.current.has(v.id)) return;
      autoTried.current.add(v.id);
      setCardLoading((prev) => ({ ...prev, [v.id]: true }));
      lookupVehicle
        .mutateAsync({ data: { registrationNumber: v.registration_number } })
        .then((result) => setCardDvlaData((prev) => ({ ...prev, [v.id]: result })))
        .catch(() => setCardError((prev) => ({ ...prev, [v.id]: true })))
        .finally(() => setCardLoading((prev) => ({ ...prev, [v.id]: false })));

      // DVSA MOT history → latest expiry for the card (works without DVLA).
      fetch(`${API_BASE}/api/vehicle/mot/${encodeURIComponent(v.registration_number)}`)
        .then(async (r) => {
          if (!r.ok) return;
          const d = (await r.json()) as { motTests?: Array<{ completedDate?: string; expiryDate?: string; testResult?: string }> };
          setCardMot((prev) => ({ ...prev, [v.id]: latestMot(d.motTests) }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Vehicles</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage vehicles and check their government records.
            </p>
          </div>

          <Dialog
            open={isCreateOpen}
            onOpenChange={(v) => {
              setIsCreateOpen(v);
              if (!v) { setDvlaPreview(null); form.reset(); }
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" data-testid="btn-add-vehicle">
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add a Vehicle</DialogTitle>
                <DialogDescription>
                  Enter the registration to auto-fill details from DVLA, then add the model.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  {/* Registration + auto-fill */}
                  <FormField
                    control={form.control}
                    name="registration_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="AB12 CDE"
                              {...field}
                              onBlur={(e) => {
                                field.onBlur();
                                // Auto-fetch DVLA details as soon as a plate is entered.
                                if (e.target.value && !dvlaPreview && !lookupVehicle.isPending) {
                                  handleAutoFill();
                                }
                              }}
                              className="uppercase font-mono tracking-wider"
                              data-testid="input-reg"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5 text-xs"
                            onClick={handleAutoFill}
                            disabled={lookupVehicle.isPending}
                          >
                            {lookupVehicle.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            DVLA
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* DVLA preview banner */}
                  {dvlaPreview && (
                    <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary">
                        ✓ Auto-filled from DVLA
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {dvlaPreview.colour && (
                          <>
                            <span className="text-muted-foreground">Colour</span>
                            <span className="capitalize">{dvlaPreview.colour.toLowerCase()}</span>
                          </>
                        )}
                        {dvlaPreview.yearOfManufacture && (
                          <>
                            <span className="text-muted-foreground">Year</span>
                            <span>{dvlaPreview.yearOfManufacture}</span>
                          </>
                        )}
                        {dvlaPreview.fuelType && (
                          <>
                            <span className="text-muted-foreground">Fuel</span>
                            <span className="capitalize">{dvlaPreview.fuelType.toLowerCase()}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {taxBadge(dvlaPreview.taxStatus)}
                        {motBadge(dvlaPreview.motStatus)}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Make</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Ford" {...field} data-testid="input-make" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Fiesta" {...field} data-testid="input-model" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsCreateOpen(false); setDvlaPreview(null); form.reset(); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createVehicle.isPending} data-testid="btn-save-vehicle">
                      {createVehicle.isPending ? "Saving…" : "Save Vehicle"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vehicle list */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : !vehicles?.length ? (
          <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Car className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-medium">No vehicles added</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto text-sm">
              Add your vehicles to link them to penalty charge notices and check their government records.
            </p>
            <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first vehicle
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => {
              const dvla = cardDvlaData[vehicle.id];
              const mot = cardMot[vehicle.id];
              const motExpiry = dvla?.motExpiryDate ?? mot?.expiry ?? null;
              const hasAny = !!dvla || !!mot;
              const isExpanded = expandedCard === vehicle.id;
              const isChecking = cardLoading[vehicle.id];

              return (
                <Card key={vehicle.id} className="overflow-hidden">
                  {/* Card header — number plate style */}
                  <div className="bg-primary/5 px-4 py-3 border-b flex justify-between items-center">
                    <div className="font-mono text-base font-bold tracking-wider text-foreground">
                      {vehicle.registration_number}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          data-testid={`btn-delete-${vehicle.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Vehicle</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove {vehicle.registration_number}? This won't delete linked PCNs.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(vehicle.id, vehicle.registration_number)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div>
                      <div className="text-sm font-medium">{vehicle.make} {vehicle.model}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Added {new Date(vehicle.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>

                    {/* MOT (DVSA) & Tax (DVLA) — auto-fetched on load */}
                    {isChecking && !hasAny ? (
                      <div className="space-y-2">
                        <Skeleton className="h-11 rounded-lg" />
                        <Skeleton className="h-11 rounded-lg" />
                      </div>
                    ) : hasAny ? (
                      <div className="space-y-2">
                        {/* MOT — prefers a real expiry date (DVLA or latest DVSA test) */}
                        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <FileCheck className="h-3.5 w-3.5" />
                            </span>
                            MOT
                          </span>
                          {motExpiry ? (
                            <span className="text-xs">
                              <span className="text-muted-foreground">Expires </span>
                              <span className="font-semibold text-green-600">{formatDate(motExpiry)}</span>
                            </span>
                          ) : dvla?.motStatus ? (
                            motBadge(dvla.motStatus)
                          ) : mot?.result ? (
                            <span className="text-xs text-muted-foreground">Last test: {mot.result}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No data</span>
                          )}
                        </div>
                        {/* Tax — DVLA only */}
                        {dvla ? (
                          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Car className="h-3.5 w-3.5" />
                              </span>
                              Tax
                            </span>
                            {dvla.taxDueDate ? (
                              <span className="text-xs">
                                <span className="text-muted-foreground">Due </span>
                                <span className="font-semibold text-green-600">{formatDate(dvla.taxDueDate)}</span>
                              </span>
                            ) : (
                              taxBadge(dvla.taxStatus)
                            )}
                          </div>
                        ) : (
                          <p className="px-1 text-[11px] text-muted-foreground">
                            Add <code className="rounded bg-muted px-1">DVLA_API_KEY</code> for tax status.
                          </p>
                        )}
                      </div>
                    ) : cardError[vehicle.id] ? (
                      <p className="text-xs text-muted-foreground">
                        Live vehicle details unavailable right now. Try again shortly.
                      </p>
                    ) : null}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {dvla && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1.5"
                          onClick={() => setExpandedCard(isExpanded ? null : vehicle.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {isExpanded ? "Hide" : "More details"}
                        </Button>
                      )}
                      {cardError[vehicle.id] && !dvla && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1.5"
                          onClick={() => handleCardLookup(vehicle.id, vehicle.registration_number)}
                          disabled={isChecking}
                        >
                          {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 gap-1.5"
                        onClick={() => setMotDialogReg(vehicle.registration_number)}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        MOT History
                      </Button>
                    </div>

                    {/* Expanded DVLA panel */}
                    {dvla && isExpanded && <DvlaInfoPanel data={dvla} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MOT History Dialog */}
      {motDialogReg && (
        <MotHistoryDialog
          registration={motDialogReg}
          open={!!motDialogReg}
          onClose={() => setMotDialogReg(null)}
        />
      )}
    </AppLayout>
  );
}
