import type { ReactNode } from "react";
import { Link } from "wouter";
import { format, differenceInCalendarDays } from "date-fns";
import {
  CheckCircle2,
  Clock,
  PoundSterling,
  Receipt,
  Scale,
  UploadCloud,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePCNs } from "@/hooks/use-pcns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeadlineCalendar } from "@/components/dashboard/deadline-calendar";
import { NearbyMap } from "@/components/dashboard/nearby-map";
import { VehiclesStrip } from "@/components/dashboard/vehicles-strip";

function StatCard({
  label,
  value,
  hint,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold leading-tight sm:text-2xl">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: pcns, isLoading } = usePCNs();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  const safePcns = pcns || [];
  const pendingPcns = safePcns.filter((p) => p.status === "pending");
  const resolvedPcns = safePcns.filter((p) => p.status === "paid");
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
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your penalty charge notices</p>
          </div>
          <Button asChild>
            <Link href="/pcns/upload">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload PCN
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Owed"
            value={`£${totalOwed.toFixed(2)}`}
            hint={`${pendingPcns.length} pending notice${pendingPcns.length === 1 ? "" : "s"}`}
            icon={<PoundSterling className="h-5 w-5" />}
            iconClass="bg-rose-100 text-rose-600"
          />
          <StatCard
            label="Pending"
            value={String(pendingPcns.length)}
            hint="Awaiting action"
            icon={<Clock className="h-5 w-5" />}
            iconClass="bg-amber-100 text-amber-600"
          />
          <StatCard
            label="Contested"
            value={String(contestedPcns.length)}
            hint="Under review"
            icon={<Scale className="h-5 w-5" />}
            iconClass="bg-blue-100 text-blue-600"
          />
          <StatCard
            label="Resolved"
            value={String(resolvedPcns.length)}
            hint="Paid / closed"
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconClass="bg-green-100 text-green-600"
          />
        </div>

        {/* Road tolls & charges */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Receipt className="h-5 w-5" />
              </span>
              <div>
                <div className="text-base font-semibold">Road tolls and charges</div>
                <div className="text-sm text-primary-foreground/80">
                  Keep track of all your expenses in one place
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" asChild>
                <Link href="/tolls?add=1">Add new</Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                asChild
              >
                <Link href="/tolls">View all</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming deadlines + recent notices */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
              <Link href="/pcns" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingPcns.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                  No upcoming deadlines. You're all caught up!
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingPcns.map((pcn) => {
                    const dueDate = new Date(pcn.due_date!);
                    const daysLeft = differenceInCalendarDays(dueDate, today);
                    const overdue = daysLeft < 0;
                    const urgent = daysLeft >= 0 && daysLeft <= 3;
                    return (
                      <div
                        key={pcn.id}
                        className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/pcns/${pcn.id}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {pcn.pcn_reference}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">{pcn.issuer}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              overdue
                                ? "border-rose-200 bg-rose-100 text-rose-700"
                                : urgent
                                ? "border-red-200 bg-red-100 text-red-700"
                                : "border-amber-200 bg-amber-100 text-amber-800"
                            }`}
                          >
                            {overdue ? "Overdue" : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">£{(pcn.amount || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Recent Notices</CardTitle>
              <Link href="/pcns" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {safePcns.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                  No notices found.
                  <div className="mt-3">
                    <Link href="/pcns/upload" className="text-sm text-primary hover:underline">
                      Upload your first notice
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {safePcns.slice(0, 4).map((pcn) => (
                    <div
                      key={pcn.id}
                      className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/pcns/${pcn.id}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {pcn.pcn_reference}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {pcn.issue_date ? format(new Date(pcn.issue_date), "dd MMM yyyy") : "Unknown date"}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ${
                          pcn.status === "pending"
                            ? "border-amber-200 bg-amber-100 text-amber-800"
                            : pcn.status === "paid"
                            ? "border-green-200 bg-green-100 text-green-800"
                            : "border-blue-200 bg-blue-100 text-blue-800"
                        }`}
                      >
                        {pcn.status === "paid"
                          ? "Resolved"
                          : pcn.status.charAt(0).toUpperCase() + pcn.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deadline calendar */}
        <DeadlineCalendar pcns={safePcns} />

        {/* EV charging & parking */}
        <NearbyMap />

        {/* My vehicles */}
        <VehiclesStrip />
      </div>
    </AppLayout>
  );
}
