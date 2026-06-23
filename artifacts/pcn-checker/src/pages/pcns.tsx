import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ChevronRight, Filter, Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePCNs } from "@/hooks/use-pcns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function statusClass(status: string) {
  if (status === "pending") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "paid") return "bg-green-100 text-green-800 border-green-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

export default function PCNsPage() {
  const { data: pcns, isLoading } = usePCNs();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPcns =
    pcns?.filter((pcn) => {
      const matchesStatus = statusFilter === "all" || pcn.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        pcn.pcn_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pcn.issuer?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    }) || [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Notices</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              View and manage all your penalty charge notices.
            </p>
          </div>
          <Link href="/pcns/upload">
            <Button className="w-full sm:w-auto" data-testid="btn-upload-pcn">
              <Plus className="h-4 w-4 mr-2" />
              Upload Notice
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1 sm:max-w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reference or issuer..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2 sm:w-48">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="contested">Contested</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Mobile card list ── */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : filteredPcns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-lg bg-muted/20">
              {pcns?.length === 0
                ? "No penalty charge notices found."
                : "No notices match your filters."}
            </div>
          ) : (
            filteredPcns.map((pcn) => (
              <Link
                key={pcn.id}
                href={`/pcns/${pcn.id}`}
                data-testid={`link-pcn-${pcn.id}`}
              >
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/40 transition-colors active:bg-muted/60">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {pcn.pcn_reference}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {pcn.issuer || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pcn.issue_date
                        ? format(new Date(pcn.issue_date), "dd MMM yyyy")
                        : "Unknown date"}
                      {pcn.due_date && (
                        <span
                          className={
                            pcn.status === "pending" &&
                            new Date(pcn.due_date) < new Date()
                              ? " · Due: overdue text-destructive"
                              : ""
                          }
                        >
                          {" "}
                          · Due {format(new Date(pcn.due_date), "dd MMM")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusClass(pcn.status)}`}
                    >
                      {pcn.status.charAt(0).toUpperCase() + pcn.status.slice(1)}
                    </Badge>
                    <span className="text-sm font-semibold">
                      £{pcn.amount?.toFixed(2) ?? "—"}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredPcns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {pcns?.length === 0
                      ? "No penalty charge notices found."
                      : "No notices match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPcns.map((pcn) => (
                  <TableRow
                    key={pcn.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={`/pcns/${pcn.id}`}
                        className="font-medium text-primary hover:underline block w-full"
                        data-testid={`link-pcn-${pcn.id}`}
                      >
                        {pcn.pcn_reference}
                      </Link>
                    </TableCell>
                    <TableCell>{pcn.issuer}</TableCell>
                    <TableCell>
                      {pcn.issue_date
                        ? format(new Date(pcn.issue_date), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {pcn.due_date ? (
                        <span
                          className={
                            pcn.status === "pending" &&
                            new Date(pcn.due_date) < new Date()
                              ? "text-destructive font-medium"
                              : ""
                          }
                        >
                          {format(new Date(pcn.due_date), "dd MMM yyyy")}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>£{pcn.amount?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusClass(pcn.status)}
                      >
                        {pcn.status.charAt(0).toUpperCase() +
                          pcn.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
