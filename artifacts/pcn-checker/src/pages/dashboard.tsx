import { Link } from "wouter";
import { format, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, FileText, PoundSterling } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePCNs } from "@/hooks/use-pcns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: pcns, isLoading } = usePCNs();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const safePcns = pcns || [];
  const pendingPcns = safePcns.filter((p) => p.status === "pending");
  const paidPcns = safePcns.filter((p) => p.status === "paid");
  const contestedPcns = safePcns.filter((p) => p.status === "contested");
  const totalOwed = pendingPcns.reduce((sum, p) => sum + (p.amount || 0), 0);

  const today = new Date();
  const upcomingPcns = pendingPcns
    .filter((p) => p.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 3);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Overview of your penalty charge notices.
          </p>
        </div>

        {/* Stats — 2 cols on mobile, 4 on desktop */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Owed</CardTitle>
              <PoundSterling className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">£{totalOwed.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingPcns.length} pending notice{pendingPcns.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{pendingPcns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Contested</CardTitle>
              <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{contestedPcns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Under review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{paidPcns.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom cards — stacked on mobile, side by side on md+ */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
              <CardDescription className="text-xs">
                Notices that require your attention soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingPcns.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg bg-muted/20">
                  No upcoming deadlines. You're all caught up!
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingPcns.map((pcn) => {
                    const dueDate = new Date(pcn.due_date!);
                    const daysLeft = differenceInDays(dueDate, today);
                    const isUrgent = daysLeft <= 3;
                    return (
                      <div
                        key={pcn.id}
                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 gap-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/pcns/${pcn.id}`}
                            className="font-medium hover:underline text-sm truncate block"
                          >
                            {pcn.pcn_reference}
                          </Link>
                          <div className="text-xs text-muted-foreground truncate">
                            {pcn.issuer}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm font-medium ${
                              isUrgent ? "text-destructive" : ""
                            }`}
                          >
                            {daysLeft < 0
                              ? "Overdue"
                              : daysLeft === 0
                              ? "Due today"
                              : `${daysLeft}d left`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            £{pcn.amount?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Notices</CardTitle>
              <CardDescription className="text-xs">
                Your latest penalty charge notices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {safePcns.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg bg-muted/20">
                  No notices found.
                  <div className="mt-3">
                    <Link href="/pcns/upload" className="text-primary hover:underline text-sm">
                      Upload your first notice
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {safePcns.slice(0, 4).map((pcn) => (
                    <div
                      key={pcn.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 gap-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/pcns/${pcn.id}`}
                          className="font-medium hover:underline text-sm truncate block"
                        >
                          {pcn.pcn_reference}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {pcn.issue_date
                            ? format(new Date(pcn.issue_date), "dd MMM yyyy")
                            : "Unknown date"}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          pcn.status === "pending"
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : pcn.status === "paid"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {pcn.status.charAt(0).toUpperCase() + pcn.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
