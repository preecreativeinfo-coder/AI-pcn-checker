import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format, differenceInDays } from "date-fns";
import { ArrowLeft, Clock, CreditCard, Edit2, FileText, Image as ImageIcon, MapPin, Save, ShieldAlert, X } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AppLayout } from "@/components/layout/app-layout";
import { usePCN, useUpdatePCN } from "@/hooks/use-pcns";
import { useVehicles } from "@/hooks/use-vehicles";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ContestLetterDialog } from "@/components/contest-letter-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const updatePcnSchema = z.object({
  pcn_reference: z.string().min(1, "Reference number is required"),
  issuer: z.string().min(1, "Issuer is required"),
  issue_date: z.string().optional().nullable(),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  due_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  vehicle_id: z.string().optional().nullable(),
});

export default function PCNDetailPage({ id }: { id: string }) {
  const { data: pcn, isLoading } = usePCN(id);
  const { data: vehicles } = useVehicles();
  const updatePcn = useUpdatePCN();
  const { toast } = useToast();
  const { session } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

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

  const onUpdateStatus = async (status: "pending" | "paid" | "contested") => {
    try {
      await updatePcn.mutateAsync({ id, status });
      toast({
        title: "Status updated",
        description: `PCN marked as ${status}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "An error occurred.",
      });
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
        vehicle_id: values.vehicle_id === "none" ? null : values.vehicle_id,
      });
      setIsEditing(false);
      toast({
        title: "Details updated",
        description: "PCN information has been saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "An error occurred.",
      });
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
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Notice not found</h2>
          <p className="text-muted-foreground mt-2">The PCN you are looking for doesn't exist.</p>
          <Link href="/pcns">
            <Button className="mt-4">Back to PCNs</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const today = new Date();
  const dueDate = pcn.due_date ? new Date(pcn.due_date) : null;
  const daysLeft = dueDate ? differenceInDays(dueDate, today) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  const linkedVehicle = pcn.vehicle_id ? vehicles?.find(v => v.id === pcn.vehicle_id) : null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header row — back + title */}
        <div className="flex items-start gap-3">
          <Link href="/pcns">
            <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" data-testid="btn-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{pcn.pcn_reference}</h1>
              <Badge variant="outline" className={
                pcn.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                pcn.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' :
                'bg-blue-100 text-blue-800 border-blue-200'
              }>
                {pcn.status.charAt(0).toUpperCase() + pcn.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm truncate">{pcn.issuer}</p>
          </div>
        </div>

        {/* Action buttons — full-width row on mobile */}
        <div className="flex flex-wrap gap-2">
          {pcn.status !== "paid" && (
            <Button 
              variant="outline" 
              size="sm"
              className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
              onClick={() => onUpdateStatus("paid")}
              data-testid="btn-mark-paid"
            >
              <CreditCard className="mr-2 h-4 w-4" /> Mark Paid
            </Button>
          )}
          <ContestLetterDialog
            pcn={pcn}
            vehicleRegistration={linkedVehicle?.registration_number}
            userEmail={session?.user?.email}
            onContested={() => onUpdateStatus("contested")}
          />
          {pcn.status !== "pending" && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onUpdateStatus("pending")}
              data-testid="btn-mark-pending"
            >
              Set Pending
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <CardTitle className="text-base font-semibold">Notice Details</CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="btn-edit">
                    <Edit2 className="h-4 w-4 mr-2" /> Edit
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                {isEditing ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormField control={form.control} name="vehicle_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {vehicles?.map(v => <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="flex justify-end">
                        <Button type="submit" data-testid="btn-save-edit"><Save className="h-4 w-4 mr-2" /> Save Changes</Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                        <CreditCard className="h-4 w-4 mr-1.5" /> Amount
                      </div>
                      <div className="text-lg font-semibold">£{pcn.amount?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                        <Clock className="h-4 w-4 mr-1.5" /> Due Date
                      </div>
                      <div className="text-base">
                        {pcn.due_date ? format(new Date(pcn.due_date), 'dd MMM yyyy') : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                        <FileText className="h-4 w-4 mr-1.5" /> Issue Date
                      </div>
                      <div className="text-base">
                        {pcn.issue_date ? format(new Date(pcn.issue_date), 'dd MMM yyyy') : '-'}
                      </div>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <div className="text-sm font-medium text-muted-foreground flex items-center mb-1">
                        <MapPin className="h-4 w-4 mr-1.5" /> Location
                      </div>
                      <div className="text-base">{pcn.location || '-'}</div>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <div className="text-sm font-medium text-muted-foreground mb-1">Linked Vehicle</div>
                      {linkedVehicle ? (
                        <div className="inline-flex items-center px-3 py-1 rounded-md bg-secondary text-secondary-foreground font-medium">
                          {linkedVehicle.registration_number} <span className="mx-2 text-muted-foreground/50">|</span> <span className="font-normal">{linkedVehicle.make} {linkedVehicle.model}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No vehicle linked</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {pcn.ocr_raw_text && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Extracted Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-md text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {pcn.ocr_raw_text}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {pcn.status === "pending" && daysLeft !== null && (
              <Card className={isOverdue ? "border-destructive bg-destructive/5" : daysLeft <= 3 ? "border-amber-300 bg-amber-50" : ""}>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold mb-1">
                    {isOverdue ? Math.abs(daysLeft) : daysLeft}
                  </div>
                  <div className={`text-sm font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverdue ? "Days Overdue" : "Days Remaining"}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center">
                  <ImageIcon className="h-5 w-5 mr-2" /> Original Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fileUrl ? (
                  <div className="border rounded-md overflow-hidden bg-muted flex items-center justify-center min-h-64">
                    {pcn.file_path?.endsWith('.pdf') ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                          View PDF Document
                        </a>
                      </div>
                    ) : (
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="block w-full">
                        <img src={fileUrl} alt="PCN Document" className="w-full h-auto object-contain max-h-96" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed rounded-md p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No document uploaded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
