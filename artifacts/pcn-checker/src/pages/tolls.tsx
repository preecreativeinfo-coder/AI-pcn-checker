import { useState } from "react";
import { useSearch } from "wouter";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MapPin, Plus, PoundSterling, Receipt, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useTolls, useCreateToll, useDeleteToll } from "@/hooks/use-tolls";
import { useVehicles } from "@/hooks/use-vehicles";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
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

const tollSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  charge_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  vehicle_id: z.string().optional().nullable(),
});

type TollFormValues = z.infer<typeof tollSchema>;

function AddTollDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: vehicles } = useVehicles();
  const createToll = useCreateToll();
  const { toast } = useToast();

  const form = useForm<TollFormValues>({
    resolver: zodResolver(tollSchema),
    defaultValues: {
      description: "",
      amount: 0,
      charge_date: new Date().toISOString().slice(0, 10),
      location: "",
      vehicle_id: "none",
    },
  });

  const onSubmit = async (values: TollFormValues) => {
    try {
      await createToll.mutateAsync({
        description: values.description,
        amount: values.amount,
        charge_date: values.charge_date || null,
        location: values.location || null,
        vehicle_id: values.vehicle_id === "none" ? null : values.vehicle_id ?? null,
      });
      toast({ title: "Charge added", description: `${values.description} saved.` });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add charge", description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add new
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a charge</DialogTitle>
          <DialogDescription>Record a road toll, congestion charge or similar.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="e.g. Dartford Crossing" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (£)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="charge_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>Location (optional)</FormLabel>
                <FormControl><Input placeholder="Where?" {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vehicle_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle (optional)</FormLabel>
                <ResponsiveSelect
                  value={field.value || "none"}
                  onValueChange={field.onChange}
                  title="Vehicle"
                  options={[
                    { value: "none", label: "No vehicle" },
                    ...(vehicles?.map((v) => ({ value: v.id, label: v.registration_number })) ?? []),
                  ]}
                />
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createToll.isPending}>
                {createToll.isPending ? "Saving…" : "Save charge"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function TollsPage() {
  const { data: tolls, isLoading } = useTolls();
  const { data: vehicles } = useVehicles();
  const deleteToll = useDeleteToll();
  const { toast } = useToast();
  // Open the add dialog immediately when arriving via "Add new".
  const search = useSearch();
  const [addOpen, setAddOpen] = useState(new URLSearchParams(search).get("add") === "1");

  const all = tolls || [];
  const total = all.reduce((sum, t) => sum + (t.amount || 0), 0);
  const regFor = (id: string | null) =>
    id ? vehicles?.find((v) => v.id === id)?.registration_number : null;

  const onDelete = async (id: string) => {
    try {
      await deleteToll.mutateAsync(id);
      toast({ title: "Charge removed" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to remove", description: error.message });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Road Tolls &amp; Charges</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep track of all your tolls and charges in one place.
            </p>
          </div>
          <AddTollDialog open={addOpen} onOpenChange={setAddOpen} />
        </div>

        {/* Total */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <PoundSterling className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs text-muted-foreground">Total recorded</div>
              <div className="text-2xl font-bold">£{total.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                {all.length} charge{all.length === 1 ? "" : "s"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : all.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Receipt className="h-6 w-6" />
              </span>
            </div>
            <h3 className="text-lg font-medium">No charges yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add road tolls, congestion charges and similar expenses to track your spending.
            </p>
            <Button className="mt-5" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add your first charge
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {all.map((toll) => {
              const reg = regFor(toll.vehicle_id);
              return (
                <Card key={toll.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Receipt className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{toll.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {toll.charge_date && <span>{format(new Date(toll.charge_date), "dd MMM yyyy")}</span>}
                        {toll.location && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {toll.location}
                            </span>
                          </>
                        )}
                        {reg && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="font-mono">{reg}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-base font-semibold">£{(toll.amount || 0).toFixed(2)}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this charge?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes "{toll.description}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => onDelete(toll.id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
