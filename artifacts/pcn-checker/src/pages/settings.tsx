import { LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

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

        {/* Sign out */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>Sign out of this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={signOut} className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
