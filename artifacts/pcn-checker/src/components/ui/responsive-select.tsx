import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ResponsiveSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Heading shown at the top of the mobile drawer. */
  title?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

const triggerClasses =
  "flex h-9 w-full select-none items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A select that renders a native Radix dropdown on desktop and a bottom
 * Drawer (action-sheet) on mobile. Drop-in for simple value/options selects.
 */
export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
  id,
  title,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: ResponsiveSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Desktop → standard Radix select.
  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className={className} aria-label={ariaLabel} data-testid={testId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile → bottom drawer action sheet.
  const selected = options.find((o) => o.value === value);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          data-testid={testId}
          className={cn(triggerClasses, !selected && "text-muted-foreground", className)}
        >
          <span className="line-clamp-1 text-left">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>{title ?? placeholder}</DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[60vh] overflow-auto px-2 pb-2">
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  onValueChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full select-none items-center justify-between rounded-md px-3 py-3 text-left text-base transition-colors disabled:opacity-50",
                  isSelected ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                {o.label}
                {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
