import { useState } from "react";
import { Link } from "wouter";
import { format, differenceInCalendarDays } from "date-fns";
import { ChevronRight, FileText, Search, Sparkles, UploadCloud } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePCNs } from "@/hooks/use-pcns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PCN_STATUSES, statusClass, statusLabel } from "@/lib/pcn-status";

const FILTERS = ["all", ...PCN_STATUSES] as const;

function dueText(dueDate: string, status: string): { text: string; className: string } | null {
  if (status === "paid" || status === "cancelled") return null;
  const days = differenceInCalendarDays(new Date(dueDate), new Date());
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, className: "text-rose-600 font-medium" };
  if (days === 0) return { text: "Due today", className: "text-red-600 font-medium" };
  if (days <= 7) return { text: `${days}d left`, className: "text-amber-600 font-medium" };
  return { text: `${days}d left`, className: "text-muted-foreground" };
}

export default function PCNsPage() {
  const { data: pcns, isLoading } = usePCNs();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const all = pcns || [];
  const filteredPcns = all.filter((pcn) => {
    const matchesStatus = statusFilter === "all" || pcn.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      pcn.pcn_reference?.toLowerCase().includes(q) ||
      pcn.issuer?.toLowerCase().includes(q) ||
      pcn.location?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My PCNs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {all.length} total notice{all.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button asChild>
            <Link href="/pcns/upload">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload PCN
            </Link>
          </Button>
        </div>

        {/* Search + filter pills */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, issuer or location…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = statusFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`filter-${f}`}
                >
                  {f === "all" ? "All" : statusLabel(f)}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : filteredPcns.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
              {all.length === 0 ? (
                <>
                  No penalty charge notices yet.
                  <div className="mt-3">
                    <Link href="/pcns/upload" className="text-primary hover:underline">
                      Upload your first notice
                    </Link>
                  </div>
                </>
              ) : (
                "No notices match your filters."
              )}
            </div>
          ) : (
            filteredPcns.map((pcn) => {
              const due = pcn.due_date ? dueText(pcn.due_date, pcn.status) : null;
              return (
                <Link key={pcn.id} href={`/pcns/${pcn.id}`} data-testid={`link-pcn-${pcn.id}`}>
                  <div className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-wide">{pcn.pcn_reference}</span>
                        <Badge variant="outline" className={`text-xs ${statusClass(pcn.status)}`}>
                          {statusLabel(pcn.status)}
                        </Badge>
                        {pcn.ai_analysis && (
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" aria-label="AI analysed" />
                        )}
                        {pcn.file_path && (
                          <FileText className="h-3.5 w-3.5 text-green-600" aria-label="Document attached" />
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">{pcn.issuer}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>
                          {pcn.issue_date ? format(new Date(pcn.issue_date), "dd MMM yyyy") : "Unknown date"}
                        </span>
                        {pcn.location && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="truncate">{pcn.location}</span>
                          </>
                        )}
                        {due && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className={due.className}>{due.text}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-stretch">
                      <span className="text-base font-semibold">
                        {pcn.amount != null ? `£${pcn.amount.toFixed(2)}` : "0"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
