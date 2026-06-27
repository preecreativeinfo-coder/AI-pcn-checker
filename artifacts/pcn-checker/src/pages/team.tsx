import { Link } from "wouter";
import { Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { useAccountMembers } from "@/hooks/use-account-members";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function NotBusiness() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team management is available on Business accounts.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </AppLayout>
  );
}

const ROLE_STYLE: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  manager: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function TeamPage() {
  const { account, isBusiness, can } = useAccount();
  const { user } = useAuth();
  const { data: members, isLoading } = useAccountMembers();

  if (!isBusiness) return <NotBusiness />;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.name ? `${account.name} · ` : ""}people with access to this account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Members
            </CardTitle>
            <CardDescription>Roles control what each member can do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : (
              (members ?? []).map((m) => {
                const isYou = m.user_id === user?.id;
                return (
                  <div key={m.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {isYou ? (user?.email ?? "You") : `Member ${m.user_id.slice(0, 8)}`}
                        {isYou && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Joined {new Date(m.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs capitalize ${ROLE_STYLE[m.role] ?? ""}`}>
                      {m.role}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {can("admin") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4" /> Invite teammates
              </CardTitle>
              <CardDescription>Add colleagues to help manage your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Email invites and role changes are coming next — they need a small server-side
                  invite step. For now the account owner is the only member.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
