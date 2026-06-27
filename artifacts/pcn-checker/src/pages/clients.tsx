import { useState } from "react";
import { Link } from "wouter";
import { Building2, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAccount } from "@/lib/account";
import { useClients, useCreateClient, useDeleteClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function NotAgency() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold">Clients</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Client management is available on Business — Agency accounts.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </AppLayout>
  );
}

export default function ClientsPage() {
  const { account, isAgency, can } = useAccount();
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!isAgency) return <NotAgency />;

  const canManage = can("manager");

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await createClient.mutateAsync(name.trim());
      toast({ title: "Client added", description: `${name.trim()} created.` });
      setName("");
      setOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't add client", description: e.message });
    }
  };

  const onDelete = async (id: string, n: string) => {
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client removed", description: `${n} deleted.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Couldn't remove client", description: e.message });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {account.name ? `${account.name} · ` : ""}manage the clients you handle PCNs for.
            </p>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setName(""); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add client</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add a client</DialogTitle>
                  <DialogDescription>Vehicles and PCNs can be assigned to this client.</DialogDescription>
                </DialogHeader>
                <Input
                  autoFocus
                  placeholder="Client name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onCreate()}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={onCreate} disabled={!name.trim() || createClient.isPending}>
                    {createClient.isPending ? "Adding…" : "Add client"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !clients?.length ? (
          <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </span>
            </div>
            <h3 className="text-lg font-medium">No clients yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add the organisations or individuals you manage PCNs for.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Added {new Date(c.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the client. Vehicles/PCNs linked to them are not deleted but will be unassigned.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => onDelete(c.id, c.name)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
