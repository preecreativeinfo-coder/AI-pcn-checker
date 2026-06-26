import { useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  differenceInCalendarDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PCN } from "@/hooks/use-pcns";

type Severity = "overdue" | "urgent" | "soon";

const SEVERITY_STYLES: Record<Severity, string> = {
  overdue: "bg-rose-500 text-white",
  urgent: "bg-red-500 text-white",
  soon: "bg-amber-400 text-amber-950",
};

function severityFor(dueDate: Date, today: Date): Severity {
  const days = differenceInCalendarDays(dueDate, today);
  if (days < 0) return "overdue";
  if (days <= 3) return "urgent";
  return "soon";
}

export function DeadlineCalendar({ pcns }: { pcns: PCN[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState<Date>(startOfMonth(today));

  // Map of yyyy-MM-dd → list of pending PCNs due that day.
  const dueByDay = new Map<string, PCN[]>();
  for (const pcn of pcns) {
    if (pcn.status !== "pending" || !pcn.due_date) continue;
    const key = format(new Date(pcn.due_date), "yyyy-MM-dd");
    const list = dueByDay.get(key) ?? [];
    list.push(pcn);
    dueByDay.set(key, list);
  }

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Deadline Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-sm font-medium">{format(cursor, "MMMM yyyy")}</span>
          <button
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="pb-2 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const due = dueByDay.get(key);
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, today);
            const severity = due ? severityFor(day, today) : null;

            const cell = (
              <div
                className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs sm:h-9 sm:w-9 sm:text-sm ${
                  severity
                    ? SEVERITY_STYLES[severity] + " font-semibold"
                    : isToday
                    ? "bg-primary/10 font-semibold text-primary"
                    : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/40"
                }`}
              >
                {format(day, "d")}
                {due && due.length > 1 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                    {due.length}
                  </span>
                )}
              </div>
            );

            return (
              <div key={key} className="py-1">
                {due ? (
                  <Link href={`/pcns/${due[0].id}`} title={due.map((p) => p.pcn_reference).join(", ")}>
                    {cell}
                  </Link>
                ) : (
                  cell
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Due soon
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Urgent (≤3 days)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Overdue
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
