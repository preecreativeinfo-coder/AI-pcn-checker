import { useState } from "react";
import { LogOut, Mail, ShieldCheck, Trash2, User } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

function DeleteAccountDialog() {
  const { session, signOut } = useAuth();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    const userId = session?.user?.id;
    if (!userId || !canDelete) return;
    setDeleting(true);
    try {
      // Remove uploaded files in the user's storage folder.
      const { data: files } = await supabase.storage.from("pcn-files").list(userId);
      if (files && files.length > 0) {
        await supabase.storage
          .from("pcn-files")
          .remove(files.map((f) => `${userId}/${f.name}`));
      }

      // Remove the user's records (RLS scopes these to their own rows).
      await supabase.from("pcns").delete().eq("user_id", userId);
      await supabase.from("vehicles").delete().eq("user_id", userId);

      toast({
        title: "Account data deleted",
        description: "Your notices, vehicles and files have been removed. Signing you out.",
      });
      await signOut();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: error.message || "An error occurred while deleting your data.",
      });
      setDeleting(false);
    }
  };

  return (
    <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:w-auto">
          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes all your PCNs, vehicles and uploaded files, and signs you out.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete" className="text-sm">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 hover:bg-rose-700"
            disabled={!canDelete || deleting}
            onClick={(e) => {
              // Keep the dialog open while the async work runs.
              e.preventDefault();
              handleDelete();
            }}
          >
            {deleting ? "Deleting…" : "Delete Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Account
            </CardTitle>
            <CardDescription>Your sign-in details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="truncate text-sm font-medium">{user?.email ?? "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Account type</div>
                <div className="text-sm font-medium">Driver Account</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data & privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data &amp; Privacy</CardTitle>
            <CardDescription>How your PCN data is handled.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your notices and vehicles are stored privately in your account and are only visible to you.
              Document scanning (OCR) runs entirely in your browser — uploaded files are sent to storage
              but never processed on a third-party OCR service.
            </p>
          </CardContent>
        </Card>

        {/* Session */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>Sign out of this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={signOut} className="w-full justify-start sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-rose-200">
          <CardHeader>
            <CardTitle className="text-base text-rose-700">Danger Zone</CardTitle>
            <CardDescription>Permanently delete your account data.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
