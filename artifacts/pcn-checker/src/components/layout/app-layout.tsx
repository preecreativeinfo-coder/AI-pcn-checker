import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Car, FileText, LayoutDashboard, LogOut, Menu, UploadCloud } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pcns", icon: FileText, label: "All PCNs" },
  { href: "/pcns/upload", icon: UploadCloud, label: "Upload" },
  { href: "/vehicles", icon: Car, label: "Vehicles" },
];

function useIsActive(href: string) {
  const [location] = useLocation();
  return location === href || (href !== "/dashboard" && location.startsWith(href));
}

function SidebarNavLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: any;
  children: ReactNode;
  onClick?: () => void;
}) {
  const isActive = useIsActive(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  );
}

function BottomTab({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const isActive = useIsActive(href);
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
        isActive ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ user, signOut, onNavClick }: { user: any; signOut: () => void; onNavClick?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4 border-b shrink-0">
        <FileText className="h-5 w-5 mr-2 text-primary" />
        <span className="font-semibold tracking-tight text-foreground">PCN Checker</span>
      </div>

      <nav className="flex-1 overflow-auto p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink key={item.href} href={item.href} icon={item.icon} onClick={onNavClick}>
            {item.label}
          </SidebarNavLink>
        ))}
      </nav>

      <div className="p-4 border-t mt-auto shrink-0">
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground truncate" title={user?.email}>
            {user?.email}
          </p>
          <p className="text-xs text-muted-foreground">Driver Account</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={signOut}
          data-testid="btn-sign-out"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background">
      {/* ── Mobile top header ── */}
      <header className="md:hidden sticky top-0 z-40 flex h-14 shrink-0 items-center border-b bg-card px-4 gap-3">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent
              user={user}
              signOut={signOut}
              onNavClick={() => setSheetOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold tracking-tight text-foreground">PCN Checker</span>
        </div>
      </header>

      {/* ── Body row ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r bg-card">
          <SidebarContent user={user} signOut={signOut} />
        </aside>

        {/* Page content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-16 border-t bg-card shadow-lg">
        {NAV_ITEMS.map((item) => (
          <BottomTab key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </nav>
    </div>
  );
}
