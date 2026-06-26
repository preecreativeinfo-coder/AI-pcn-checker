import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { format, differenceInCalendarDays } from "date-fns";
import {
  AlertTriangle,
  ChevronLeft,
  CreditCard,
  ExternalLink,
  FileText,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AppLayout } from "@/components/layout/app-layout";
import { usePCN, useUpdatePCN, useDeletePCN, type PCNStatus } from "@/hooks/use-pcns";
import { useVehicles } from "@/hooks/use-vehicles";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ContestLetterDialog } from "@/components/contest-letter-dialog";
import { contraventionDescription } from "@/lib/contravention-codes";
import { paymentPortal } from "@/lib/payment-portals";
import { PCN_STATUSES, statusClass, statusLabel } from "@/lib/pcn-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { Card, CardContent } from "@/components/ui/card";
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

const updatePcnSchema = z.object({
  pcn_reference: z.string().min(1, "Reference number is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issue_date: z.string().optional().nullable(),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  due_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  contravention_code: z.string().optional().nullable(),
  contravention_time: z.string().optional().nullable(),
  vehicle_id: z.string().optional().nullable(),
});

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default function PCNDetailPage({ id }: { id: string }) {
  const { data: pcn, isLoading } = usePCN(id);
  const { data: vehicles } = useVehicles();
  const updatePcn = useUpdatePCN();
  const deletePcn = useDeletePCN();
  const { toast } = useToast();
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  const form = useForm<z.infer<typeof updatePcnSchema>>({
    resolver: zodResolver(updatePcnSchema),
  });

  useEffect(() => {
    if (pcn) {
      form.reset({
        pcn_reference: pcn.pcn_reference,
        issuer: pcn.issuer,
        issue_date: pcn.issue_date || "",
        amount: pcn.amount || 0,
        due_date: pcn.due_date || "",
        location: pcn.location || "",
        contravention_code: pcn.contravention_code || "",
        contravention_time: pcn.contravention_time || "",
        vehicle_id: pcn.vehicle_id || "none",
      });

      if (pcn.file_path) {
        supabase.storage
          .from("pcn-files")
          .createSignedUrl(pcn.file_path, 3600)
          .then(({ data }) => {
            if (data?.signedUrl) setFileUrl(data.signedUrl);
          });
      }
    }
  }, [pcn, form]);

  const onUpdateStatus = async (status: PCNStatus) => {
    try {
      await updatePcn.mutateAsync({ id, status });
      toast({ title: "Status updated", description: `Marked as ${statusLabel(status)}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    }
  };

  const onSubmit = async (values: z.infer<typeof updatePcnSchema>) => {
    try {
      await updatePcn.mutateAsync({
        id,
        pcn_reference: values.pcn_reference,
        issuer: values.issuer,
        issue_date: values.issue_date || null,
        amount: values.amount,
        due_date: values.due_date || null,
        location: values.location || null,
        contravention_code: values.contravention_code || null,
        contravention_time: values.contravention_time || null,
        vehicle_id: values.vehicle_id === "none" ? null : values.vehicle_id,
      });
      setIsEditing(false);
      toast({ title: "Details updated", description: "PCN information has been saved." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    }
  };

  const onDelete = async () => {
    try {
      await deletePcn.mutateAsync(id);
      toast({ title: "Notice deleted" });
      setLocation("/pcns");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!pcn) {
    return (
      <AppLayout>
        <div className="py-12 text-center">
          <h2 className="text-2xl font-bold">Notice not found</h2>
          <p className="mt-2 text-muted-foreground">The PCN you are looking for doesn't exist.</p>
          <Button className="mt-4" asChild>
            <Link href="/pcns">Back to PCNs</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const today = new Date();
  const dueDate = pcn.due_date ? new Date(pcn.due_date) : null;
  const daysLeft = dueDate ? differenceInCalendarDays(dueDate, today) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && pcn.status === "pending";
  const linkedVehicle = pcn.vehicle_id ? vehicles?.find((v) => v.id === pcn.vehicle_id) : null;
  const allegedContravention = contraventionDescription(pcn.contravention_code);
  const portal = paymentPortal(pcn.issuer);
  const showPay = pcn.status !== "paid" && pcn.status !== "cancelled";

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
              <Link href="/pcns" aria-label="Back">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{pcn.pcn_reference}</h1>
                <Badge variant="outline" className={statusClass(pcn.status)}>
                  {statusLabel(pcn.status)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{pcn.issuer}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setTab("overview"); setIsEditing((v) => !v); }} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-rose-600 hover:text-rose-700" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this notice?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes {pcn.pcn_reference} and its analysis. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={onDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Overdue banner */}
        {isOverdue && daysLeft !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Overdue by {Math.abs(daysLeft)} day{Math.abs(daysLeft) === 1 ? "" : "s"}!
          </div>
        )}

        {/* Pay online banner */}
        {showPay && (
          <a
            href={portal.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg bg-green-600 px-4 py-3 text-white transition-colors hover:bg-green-700"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Pay this PCN online</div>
                <div className="text-xs text-white/80">
                  {portal.known ? `Go to ${pcn.issuer} payment portal` : "Find your council's payment page on gov.uk"}
                </div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </a>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="appeal">
              Appeal Letter
              {(pcn.status === "contested" || pcn.status === "appealed") && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardContent className="p-5">
                {isEditing ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="pcn_reference" render={({ field }) => (
                          <FormItem><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="issuer" render={({ field }) => (
                          <FormItem><FormLabel>Issuer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="issue_date" render={({ field }) => (
                          <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="due_date" render={({ field }) => (
                          <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="amount" render={({ field }) => (
                          <FormItem><FormLabel>Amount (£)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="contravention_code" render={({ field }) => (
                          <FormItem><FormLabel>Contravention Code</FormLabel><FormControl><Input {...field} value={field.value || ""} placeholder="e.g. 11" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="contravention_time" render={({ field }) => (
                          <FormItem><FormLabel>Contravention Time</FormLabel><FormControl><Input type="time" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicle_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle</FormLabel>
                            <ResponsiveSelect
                              value={field.value || "none"}
                              onValueChange={field.onChange}
                              title="Vehicle"
                              options={[
                                { value: "none", label: "None" },
                                ...(vehicles?.map((v) => ({ value: v.id, label: v.registration_number })) ?? []),
                              ]}
                            />
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                          <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field label="Issue Date" icon={<FileText className="h-4 w-4" />}>
                        {pcn.issue_date ? format(new Date(pcn.issue_date), "dd MMM yyyy") : "—"}
                      </Field>
                      <Field label="Due Date" icon={<FileText className="h-4 w-4" />}>
                        {pcn.due_date ? format(new Date(pcn.due_date), "dd MMM yyyy") : "—"}
                      </Field>
                      <Field label="Amount" icon={<CreditCard className="h-4 w-4" />}>
                        {pcn.amount != null ? `£${pcn.amount.toFixed(2)}` : "—"}
                      </Field>
                      <Field label="Discounted (14 days)" icon={<CreditCard className="h-4 w-4" />}>
                        {pcn.amount != null ? `£${(pcn.amount / 2).toFixed(2)}` : "—"}
                      </Field>
                      <Field label="Vehicle" icon={<FileText className="h-4 w-4" />}>
                        {linkedVehicle ? linkedVehicle.registration_number : "—"}
                      </Field>
                      <Field label="Contravention Code" icon={<FileText className="h-4 w-4" />}>
                        {pcn.contravention_code || "—"}
                      </Field>
                      <Field label="Contravention Time" icon={<FileText className="h-4 w-4" />}>
                        {pcn.contravention_time || "—"}
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Location" icon={<FileText className="h-4 w-4" />}>
                          {pcn.location || "—"}
                        </Field>
                      </div>
                    </div>

                    {allegedContravention && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-medium text-amber-700">Alleged Contravention</div>
                        <div className="mt-0.5 text-sm text-amber-900">{allegedContravention}</div>
                      </div>
                    )}

                    {fileUrl && (
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                        <FileText className="h-4 w-4" /> View original document
                      </a>
                    )}

                    {/* Status control */}
                    <div className="flex items-center gap-3 border-t pt-4">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <ResponsiveSelect
                        value={pcn.status}
                        onValueChange={(v) => onUpdateStatus(v as PCNStatus)}
                        className="w-44"
                        title="Update status"
                        options={PCN_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {pcn.ocr_raw_text && (
              <details className="mt-4 rounded-lg border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium">Extracted text from document</summary>
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs font-mono">
                  {pcn.ocr_raw_text}
                </pre>
              </details>
            )}

            {/* Bottom action */}
            <div className="mt-5">
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setTab("appeal")}>
                <FileText className="mr-2 h-4 w-4" /> New Appeal Letter
              </Button>
            </div>
          </TabsContent>

          {/* ── Appeal Letter ── */}
          <TabsContent value="appeal" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <FileText className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Generate a formal appeal letter</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your grounds and we'll draft a representation letter for {pcn.pcn_reference} you can copy or download.
                  </p>
                </div>
                <ContestLetterDialog
                  pcn={pcn}
                  vehicleRegistration={linkedVehicle?.registration_number}
                  userEmail={session?.user?.email}
                  onContested={() => onUpdateStatus("contested")}
                  trigger={
                    <Button className="bg-green-600 hover:bg-green-700">
                      <FileText className="mr-2 h-4 w-4" /> New Appeal Letter
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
