import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  File as FileIcon,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { useVehicles, useCreateVehicle, type Vehicle } from "@/hooks/use-vehicles";
import { usePCNs, useCreatePCN } from "@/hooks/use-pcns";
import { useClients } from "@/hooks/use-clients";
import { runOcr } from "@/lib/ocr";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveSelect } from "@/components/ui/responsive-select";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif,application/pdf,.doc,.docx";

type RowStatus = "queued" | "processing" | "saved" | "duplicate" | "failed";

interface Row {
  file: File;
  status: RowStatus;
  reference?: string;
  pcnId?: string;
  message?: string;
}

const STATUS_BADGE: Record<RowStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground border" },
  processing: { label: "Processing…", className: "bg-blue-100 text-blue-800 border-blue-200" },
  saved: { label: "Saved", className: "bg-green-100 text-green-800 border-green-200" },
  duplicate: { label: "Duplicate — skipped", className: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

function NotBusiness() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold">Bulk upload</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bulk upload is available on Business accounts.</p>
        <Button className="mt-4" asChild><Link href="/pcns/upload">Single upload</Link></Button>
      </div>
    </AppLayout>
  );
}

export default function BulkUploadPage() {
  const { account, isBusiness, isAgency } = useAccount();
  const { session } = useAuth();
  const { data: vehicles } = useVehicles();
  const { data: pcns } = usePCNs();
  const { data: clients } = useClients();
  const createVehicle = useCreateVehicle();
  const createPCN = useCreatePCN();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [clientId, setClientId] = useState("");
  const [running, setRunning] = useState(false);

  if (!isBusiness) return <NotBusiness />;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setRows((prev) => [...prev, ...Array.from(files).map((file) => ({ file, status: "queued" as RowStatus }))]);
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const normalise = (s: string) => s.replace(/\s+/g, "").toUpperCase();

  const processAll = async () => {
    if (!session?.user?.id) return;
    if (isAgency && !clientId) {
      toast({ variant: "destructive", title: "Select a client", description: "Choose the client this batch belongs to." });
      return;
    }
    setRunning(true);

    // Local indexes kept fresh within the batch (the query caches are stale mid-run).
    const vehByReg = new Map<string, string>(); // normalised reg -> vehicle id
    for (const v of vehicles ?? []) vehByReg.set(normalise(v.registration_number), v.id);
    const seenRefs = new Set<string>();
    for (const p of pcns ?? []) if (p.pcn_reference) seenRefs.add(normalise(p.pcn_reference));

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "saved" || rows[i].status === "duplicate") continue;
      update(i, { status: "processing", message: undefined });
      try {
        const result = await runOcr(rows[i].file);
        const ref = result.pcnReference ? normalise(result.pcnReference) : null;

        if (ref && seenRefs.has(ref)) {
          update(i, { status: "duplicate", reference: result.pcnReference ?? undefined });
          continue;
        }

        // Resolve vehicle (match by reg, else create).
        let vehicleId: string | null = null;
        const reg = result.registration ? normalise(result.registration) : null;
        if (reg) {
          const existing = vehByReg.get(reg);
          if (existing) {
            vehicleId = existing;
          } else {
            const created = (await createVehicle.mutateAsync({
              registration_number: reg,
              make: result.make || "Unknown",
              model: result.model || "Unknown",
              colour: result.colour || null,
              vehicle_type: result.vehicleType || null,
              client_id: isAgency ? clientId || null : null,
            })) as Vehicle;
            vehicleId = created.id;
            vehByReg.set(reg, created.id);
          }
        }

        // Upload the original file.
        let filePath: string | null = null;
        const ext = rows[i].file.name.split(".").pop();
        const storagePath = `${session.user.id}/${Date.now()}_${i}_pcn.${ext}`;
        const { error: upErr } = await supabase.storage.from("pcn-files").upload(storagePath, rows[i].file);
        if (!upErr) filePath = storagePath;

        const created = await createPCN.mutateAsync({
          pcn_reference: result.pcnReference || `UNKNOWN-${Date.now()}-${i}`,
          issuer: result.issuer || "Unknown",
          issue_date: result.issueDate || null,
          contravention_time: result.contraventionTime || null,
          contravention_code: result.contraventionCode || null,
          amount: result.amount ?? 0,
          due_date: result.dueDate || null,
          location: result.location || null,
          status: "pending",
          vehicle_id: vehicleId,
          file_path: filePath,
          ocr_raw_text: result.rawText || null,
        });

        if (ref) seenRefs.add(ref);
        update(i, { status: "saved", reference: result.pcnReference ?? undefined, pcnId: created.id });
      } catch (e: any) {
        update(i, { status: "failed", message: e?.message || "Couldn't process this file" });
      }
    }

    queryClient.invalidateQueries({ queryKey: ["pcns", account.id ?? session.user.id] });
    queryClient.invalidateQueries({ queryKey: ["vehicles", account.id ?? session.user.id] });
    setRunning(false);
    toast({ title: "Batch complete", description: `Processed ${rows.length} file(s).` });
  };

  const savedCount = rows.filter((r) => r.status === "saved").length;
  const dupCount = rows.filter((r) => r.status === "duplicate").length;
  const failCount = rows.filter((r) => r.status === "failed").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/pcns"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bulk upload</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload several PCNs at once. Each is scanned, matched to a vehicle, and saved.
            </p>
          </div>
        </div>

        {isAgency && (
          <Card>
            <CardContent className="space-y-1.5 p-4">
              <label className="text-sm font-medium">Client for this batch <span className="text-rose-500">*</span></label>
              <ResponsiveSelect
                value={clientId}
                onValueChange={setClientId}
                title="Client"
                placeholder={clients?.length ? "Select client" : "No clients yet — add one in Clients"}
                options={(clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-dashed bg-muted/10">
          <CardContent className="pt-6">
            <div
              className="flex flex-col items-center justify-center rounded-lg px-4 py-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <div className="mb-3 rounded-full bg-primary/10 p-3"><UploadCloud className="h-7 w-7 text-primary" /></div>
              <h3 className="mb-1 font-semibold">Drop files or select multiple</h3>
              <p className="mb-4 text-sm text-muted-foreground">JPG, PNG, HEIC, PDF, DOCX</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={running}>Select files</Button>
            </div>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {rows.length} file(s)
                {(savedCount > 0 || dupCount > 0 || failCount > 0) && (
                  <> · <span className="text-green-600">{savedCount} saved</span>
                    {dupCount > 0 && <> · <span className="text-amber-600">{dupCount} duplicate</span></>}
                    {failCount > 0 && <> · <span className="text-rose-600">{failCount} failed</span></>}</>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRows([])} disabled={running}>Clear</Button>
                <Button onClick={processAll} disabled={running}>
                  {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Process ${rows.length} file(s)`}
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="divide-y p-0">
                {rows.map((r, i) => {
                  const badge = STATUS_BADGE[r.status];
                  return (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {r.status === "saved" ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                          : r.status === "failed" ? <XCircle className="h-4 w-4 text-rose-600" />
                          : r.status === "duplicate" ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                          : r.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <FileIcon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.file.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.reference ? `Ref ${r.reference}` : `${(r.file.size / 1024 / 1024).toFixed(2)} MB`}
                          {r.message ? ` · ${r.message}` : ""}
                        </div>
                      </div>
                      {r.pcnId ? (
                        <Link href={`/pcns/${r.pcnId}`} className="shrink-0 text-xs font-medium text-primary hover:underline">
                          Review
                        </Link>
                      ) : (
                        <Badge variant="outline" className={`shrink-0 text-xs ${badge.className}`}>{badge.label}</Badge>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Tip: open any saved notice to review low-confidence fields. Duplicates (same PCN number) are skipped automatically.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
