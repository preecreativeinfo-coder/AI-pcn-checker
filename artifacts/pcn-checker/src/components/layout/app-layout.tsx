import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Car, FileText, LayoutDashboard, LogOut, Receipt, Settings, UploadCloud } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// Desktop sidebar nav (full set, incl. Upload PCN).
const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pcns", icon: FileText, label: "My PCNs" },
  { href: "/vehicles", icon: Car, label: "Vehicles" },
  { href: "/tolls", icon: Receipt, label: "Tolls & Charges" },
  { href: "/pcns/upload", icon: UploadCloud, label: "Upload PCN" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

// Mobile bottom tab bar (four primary destinations; Upload lives on the pages).
const TAB_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pcns", icon: FileText, label: "PCNs" },
  { href: "/vehicles", icon: Car, label: "Vehicles" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

/** Brand mark — gradient "AI" badge matching the app identity. */
function BrandMark() {
  return (
    <div className="flex items-center gap-2 select-none">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
        AI
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-foreground">AI PCN Checker</div>
        <div className="text-[11px] text-muted-foreground">UK Parking Fines</div>
      </div>
    </div>
  );
}

function useIsActive(href: string) {
  const [location] = useLocation();
  return location === href || (href !== "/dashboard" && location.startsWith(href));
}

function SidebarNavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: any;
  children: ReactNode;
}) {
  const isActive = useIsActive(href);
  return (
    <Link
      href={href}
      className={`flex select-none items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
      className={`flex flex-1 select-none flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
        isActive ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4 border-b shrink-0">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-auto p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink key={item.href} href={item.href} icon={item.icon}>
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

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background">
      {/* ── Body row ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar (md+ only — unchanged) */}
        <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r bg-card">
          <SidebarContent user={user} signOut={signOut} />
        </aside>

        {/* Page content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className="flex-1 px-safe p-4 pt-[calc(1rem+env(safe-area-inset-top))] md:p-8 md:pt-8">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar (replaces the header/hamburger entirely) ──
          In-flow (not fixed) so route-transition transforms can't reparent it;
          the 100dvh column keeps it pinned to the bottom of the viewport. */}
      <nav className="md:hidden shrink-0 border-t bg-card shadow-lg px-safe pb-safe">
        <div className="flex h-16">
          {TAB_ITEMS.map((item) => (
            <BottomTab key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </div>
      </nav>
    </div>
  );
}
