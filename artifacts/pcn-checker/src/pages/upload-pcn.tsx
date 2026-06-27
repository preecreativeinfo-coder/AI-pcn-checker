import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  ExternalLink,
  File as FileIcon,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useVehicles, useCreateVehicle, useUpdateVehicle } from "@/hooks/use-vehicles";
import { usePCNs, useCreatePCN } from "@/hooks/use-pcns";
import { useAccount } from "@/lib/account";
import { useClients } from "@/hooks/use-clients";
import { runOcr, type Confidence, type ExtractField } from "@/lib/ocr";
import { paymentPortal } from "@/lib/payment-portals";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif,application/pdf,.doc,.docx";

const pcnFormSchema = z.object({
  pcn_reference: z.string().min(1, "Reference number is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issue_date: z.string().optional().nullable(),
  contravention_time: z.string().optional().nullable(),
  contravention_code: z.string().optional().nullable(),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  due_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  status: z.enum(["pending", "paid", "contested"]).default("pending"),
  registration_number: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  colour: z.string().optional().nullable(),
  vehicle_type: z.string().optional().nullable(),
});

type PCNFormValues = z.infer<typeof pcnFormSchema>;
type ConfMap = Partial<Record<ExtractField, Confidence>>;

function ConfidenceBadge({ c }: { c?: Confidence }) {
  if (c === "high")
    return <Badge variant="outline" className="border-green-200 bg-green-100 text-green-700 text-[10px]">High confidence</Badge>;
  if (c === "medium")
    return <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 text-[10px]">Medium</Badge>;
  if (c === "low")
    return <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]">Low — please check</Badge>;
  return <Badge variant="outline" className="border-muted bg-muted text-muted-foreground text-[10px]">Not detected</Badge>;
}

export default function UploadPCNPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "form">("upload");
  const [progress, setProgress] = useState<{ stage: string; pct: number | null }>({ stage: "Starting", pct: null });
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [conf, setConf] = useState<ConfMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; reference: string } | null>(null);

  const { data: vehicles } = useVehicles();
  const { data: pcns } = usePCNs();
  const { isAgency } = useAccount();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState("");
  const createPCN = useCreatePCN();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const form = useForm<PCNFormValues>({
    resolver: zodResolver(pcnFormSchema),
    defaultValues: {
      pcn_reference: "", issuer: "", issue_date: "", contravention_time: "",
      contravention_code: "", amount: 0, due_date: "", location: "", status: "pending",
      registration_number: "", make: "", model: "", colour: "", vehicle_type: "",
    },
  });

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setStep("processing");
    setProgress({ stage: "Reading file", pct: null });

    try {
      const result = await runOcr(selectedFile, (stage, pct) => setProgress({ stage, pct }));
      form.reset({
        pcn_reference: result.pcnReference || "",
        issuer: result.issuer || "",
        issue_date: result.issueDate || "",
        contravention_time: result.contraventionTime || "",
        contravention_code: result.contraventionCode || "",
        amount: result.amount || 0,
        due_date: result.dueDate || "",
        location: result.location || "",
        status: "pending",
        registration_number: result.registration || "",
        make: result.make || "",
        model: result.model || "",
        colour: result.colour || "",
        vehicle_type: result.vehicleType || "",
      });
      setConf(result.confidence);
      setRawOcrText(result.rawText || null);
      setStep("form");

      const found = Object.keys(result.confidence).length;
      toast({
        title: found ? "Details extracted" : "Couldn't read much",
        description: found
          ? "Review the highlighted fields, then save."
          : "We couldn't extract details automatically. Please enter them manually.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Couldn't process file",
        description: error?.message || "Enter the details manually below.",
      });
      setConf({});
      setStep("form"); // allow manual entry
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  /** Find existing vehicle for a registration (RLS scopes to this user). */
  const findVehicle = (reg: string) => {
    const norm = reg.replace(/\s+/g, "").toUpperCase();
    return vehicles?.find((v) => v.registration_number.replace(/\s+/g, "").toUpperCase() === norm) ?? null;
  };

  const doSave = async (values: PCNFormValues) => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    try {
      // 1. Upload the original document.
      let filePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const storagePath = `${session.user.id}/${Date.now()}_pcn.${ext}`;
        const { error: upErr } = await supabase.storage.from("pcn-files").upload(storagePath, file);
        if (upErr) {
          toast({ variant: "destructive", title: "File upload failed", description: "The notice was saved without the attachment." });
        } else {
          filePath = storagePath;
        }
      }

      // 2. Resolve the vehicle — find by VRM, else auto-create.
      let vehicleId: string | null = null;
      const reg = values.registration_number?.trim();
      if (reg) {
        const existing = findVehicle(reg);
        if (existing) {
          vehicleId = existing.id;
          // Fill in any details we now have but the record was missing.
          const patch: Record<string, string> = {};
          if (values.make && (!existing.make || existing.make === "Unknown")) patch.make = values.make;
          if (values.model && (!existing.model || existing.model === "Unknown")) patch.model = values.model;
          if (values.colour && !existing.colour) patch.colour = values.colour;
          if (values.vehicle_type && !existing.vehicle_type) patch.vehicle_type = values.vehicle_type;
          if (Object.keys(patch).length > 0) {
            await updateVehicle.mutateAsync({ id: existing.id, ...patch });
          }
        } else {
          if (isAgency && !clientId) {
            toast({ variant: "destructive", title: "Select a client", description: "Assign this vehicle to a client before saving." });
            return;
          }
          const created = await createVehicle.mutateAsync({
            registration_number: reg.toUpperCase(),
            make: values.make || "Unknown",
            model: values.model || "Unknown",
            colour: values.colour || null,
            vehicle_type: values.vehicle_type || null,
            client_id: isAgency ? clientId || null : null,
          });
          vehicleId = created.id;
        }
      }

      // 3. Create the PCN linked to the vehicle.
      const created = await createPCN.mutateAsync({
        pcn_reference: values.pcn_reference,
        issuer: values.issuer,
        issue_date: values.issue_date || null,
        contravention_time: values.contravention_time || null,
        contravention_code: values.contravention_code || null,
        amount: values.amount,
        due_date: values.due_date || null,
        location: values.location || null,
        status: values.status,
        vehicle_id: vehicleId,
        file_path: filePath,
        ocr_raw_text: rawOcrText,
      });

      toast({ title: "Notice saved", description: vehicleId ? "Linked to its vehicle." : "Added to your notices." });
      setLocation(`/pcns/${created.id}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to save notice", description: error.message || "An error occurred." });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (values: PCNFormValues) => {
    // Duplicate detection by PCN number.
    const ref = values.pcn_reference.trim().toUpperCase();
    const dup = pcns?.find((p) => p.pcn_reference?.trim().toUpperCase() === ref);
    if (dup) {
      setDuplicate({ id: dup.id, reference: dup.pcn_reference });
      return;
    }
    await doSave(values);
  };

  // Live issuer → council/gov.uk deep-link, so users can look the PCN up when
  // OCR only caught the number.
  const watchedIssuer = form.watch("issuer");
  const portal = paymentPortal(watchedIssuer);

  // Confidence helpers for the review form.
  const lowConf = (f: ExtractField) => !conf[f] || conf[f] === "low";
  const ringClass = (f: ExtractField) => (lowConf(f) ? "border-amber-400 focus-visible:ring-amber-300" : "");

  const lowCount = (["pcnReference", "issuer", "issueDate", "amount", "dueDate", "location", "registration", "contraventionCode", "contraventionTime"] as ExtractField[])
    .filter((f) => conf[f] === "low").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/pcns"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Upload Notice</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a PCN and we'll extract the details and link the vehicle automatically.
            </p>
          </div>
        </div>

        {/* ── Upload ── */}
        {step === "upload" && (
          <Card className="border-2 border-dashed bg-muted/10">
            <CardContent className="pt-6">
              <div
                className={`flex flex-col items-center justify-center rounded-lg px-4 py-12 text-center transition-colors ${isDragging ? "bg-primary/5" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
              >
                <div className="mb-4 rounded-full bg-primary/10 p-4">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Drag and drop your notice</h3>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                  We'll automatically read the vehicle and PCN details from a photo, scan or document.
                </p>
                <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPT} onChange={onFileInput} data-testid="input-file" />
                <Button onClick={() => fileInputRef.current?.click()} data-testid="btn-select-file">Select file</Button>
                <p className="mt-4 text-xs text-muted-foreground">Supported: JPG, PNG, HEIC, PDF, DOCX</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Processing ── */}
        {step === "processing" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
              <h3 className="mb-1 text-lg font-semibold">{progress.stage}…</h3>
              <p className="mb-5 text-sm text-muted-foreground">Extracting details from {file?.name}</p>
              <div className="w-full max-w-xs">
                <Progress value={progress.pct ?? undefined} className={progress.pct === null ? "animate-pulse" : ""} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Review & save ── */}
        {step === "form" && (
          <>
            <Alert className="border-primary/20 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle>Review extracted details</AlertTitle>
              <AlertDescription className="text-xs">
                Verify everything below before saving.
                {lowCount > 0 && <> <strong>{lowCount}</strong> field{lowCount === 1 ? " is" : "s are"} low-confidence and highlighted in amber.</>}
              </AlertDescription>
            </Alert>

            {/* Look up the official record when OCR only caught the number. */}
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Couldn't read everything? Look this PCN up on the issuer's website and copy the rest.
              </span>
              <a
                href={portal.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
              >
                {portal.known ? `Check on ${watchedIssuer}'s site` : "Find your council on gov.uk"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {file && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded bg-muted p-2"><FileIcon className="h-6 w-6 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · attached to this notice</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* PCN details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Notice details</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="pcn_reference" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>PCN Reference</FormLabel><ConfidenceBadge c={conf.pcnReference} /></div>
                            <FormControl><Input {...field} className={ringClass("pcnReference")} data-testid="input-reference" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="issuer" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Issuing Authority</FormLabel><ConfidenceBadge c={conf.issuer} /></div>
                            <FormControl><Input {...field} className={ringClass("issuer")} placeholder="e.g. Transport for London" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="issue_date" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Contravention Date</FormLabel><ConfidenceBadge c={conf.issueDate} /></div>
                            <FormControl><Input type="date" {...field} value={field.value || ""} className={ringClass("issueDate")} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="contravention_time" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Time</FormLabel><ConfidenceBadge c={conf.contraventionTime} /></div>
                            <FormControl><Input type="time" {...field} value={field.value || ""} className={ringClass("contraventionTime")} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="contravention_code" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Contravention Code</FormLabel><ConfidenceBadge c={conf.contraventionCode} /></div>
                            <FormControl><Input {...field} value={field.value || ""} className={ringClass("contraventionCode")} placeholder="e.g. 11" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="amount" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Amount (£)</FormLabel><ConfidenceBadge c={conf.amount} /></div>
                            <FormControl><Input type="number" step="0.01" {...field} className={ringClass("amount")} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="due_date" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Payment Deadline</FormLabel><ConfidenceBadge c={conf.dueDate} /></div>
                            <FormControl><Input type="date" {...field} value={field.value || ""} className={ringClass("dueDate")} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <ResponsiveSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              title="Status"
                              options={[
                                { value: "pending", label: "Pending" },
                                { value: "paid", label: "Paid" },
                                { value: "contested", label: "Contested" },
                              ]}
                            />
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between"><FormLabel>Location</FormLabel><ConfidenceBadge c={conf.location} /></div>
                          <FormControl><Input {...field} value={field.value || ""} className={ringClass("location")} placeholder="Where was the notice issued?" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Vehicle details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Car className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Vehicle</h3>
                        <span className="text-xs text-muted-foreground">— matched or created automatically from the registration</span>
                      </div>

                      {isAgency && (
                        <div>
                          <label className="text-sm font-medium">
                            Client <span className="text-rose-500">*</span>
                          </label>
                          <div className="mt-1.5">
                            <ResponsiveSelect
                              value={clientId}
                              onValueChange={setClientId}
                              title="Client"
                              placeholder={clients?.length ? "Select client" : "No clients yet — add one in Clients"}
                              options={(clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            New vehicles created from this notice will be assigned to this client.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="registration_number" render={({ field }) => {
                          const reg = (field.value || "").trim();
                          const existing = reg ? findVehicle(reg) : null;
                          return (
                            <FormItem>
                              <div className="flex items-center justify-between"><FormLabel>Registration (VRM)</FormLabel><ConfidenceBadge c={conf.registration} /></div>
                              <FormControl><Input {...field} value={field.value || ""} className={`font-mono uppercase tracking-wider ${ringClass("registration")}`} placeholder="AB12 CDE" /></FormControl>
                              {reg && (
                                <p className="text-xs text-muted-foreground">
                                  {existing ? `Will link to existing vehicle ${existing.registration_number}.` : "New vehicle will be created."}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }} />
                        <FormField control={form.control} name="colour" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Colour</FormLabel><ConfidenceBadge c={conf.colour} /></div>
                            <FormControl><Input {...field} value={field.value || ""} className={ringClass("colour")} placeholder="e.g. Silver" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="make" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Make</FormLabel><ConfidenceBadge c={conf.make} /></div>
                            <FormControl><Input {...field} value={field.value || ""} className={ringClass("make")} placeholder="e.g. Ford" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="model" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Model</FormLabel><ConfidenceBadge c={conf.model} /></div>
                            <FormControl><Input {...field} value={field.value || ""} className={ringClass("model")} placeholder="e.g. Focus" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="vehicle_type" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Vehicle Type</FormLabel><ConfidenceBadge c={conf.vehicleType} /></div>
                            <FormControl><Input {...field} value={field.value || ""} className={ringClass("vehicleType")} placeholder="e.g. Car" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                      <Button type="button" variant="outline" onClick={() => { setStep("upload"); setFile(null); setConf({}); }}>
                        Start over
                      </Button>
                      <Button type="submit" disabled={isSaving} data-testid="btn-save">
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save notice"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Duplicate detection dialog */}
      <AlertDialog open={!!duplicate} onOpenChange={(o) => !o && setDuplicate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Possible duplicate
            </AlertDialogTitle>
            <AlertDialogDescription>
              A notice with reference <strong>{duplicate?.reference}</strong> already exists. You can open the existing
              record to update it, or cancel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => duplicate && setLocation(`/pcns/${duplicate.id}`)}>
              View existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
