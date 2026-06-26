import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type AccountType = "personal" | "business_fleet" | "business_agency";
export type AccountRole = "owner" | "admin" | "manager" | "viewer";

export interface Account {
  /** null until the accounts migration is applied AND a row is backfilled. */
  id: string | null;
  type: AccountType;
  role: AccountRole;
  name: string | null;
  /** true once a real account row has loaded (vs. the personal fallback). */
  ready: boolean;
}

// Backward-compatible default: behaves exactly like today's single-user
// personal account, so the app keeps working before Feature B's migration
// and backfill land.
const DEFAULT_ACCOUNT: Account = {
  id: null,
  type: "personal",
  role: "owner",
  name: null,
  ready: false,
};

const ROLE_RANK: Record<AccountRole, number> = { viewer: 0, manager: 1, admin: 2, owner: 3 };

interface AccountContextValue {
  account: Account;
  isLoading: boolean;
  isPersonal: boolean;
  isBusiness: boolean;
  isFleet: boolean;
  isAgency: boolean;
  /** Role gate: true if the current role is at least `min`. */
  can: (min: AccountRole) => boolean;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["account", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Account> => {
      // Defensive: before migration-005 is applied this query errors (table
      // missing); before the backfill it returns no rows. Either way we fall
      // back to a synthetic personal/owner account so nothing breaks.
      const { data, error } = await supabase
        .from("account_users")
        .select("role, accounts ( id, type, name )")
        .eq("user_id", userId!)
        .limit(1)
        .maybeSingle();

      if (error || !data) return DEFAULT_ACCOUNT;
      const acc = data.accounts as unknown as { id: string; type: AccountType; name: string } | null;
      if (!acc) return DEFAULT_ACCOUNT;
      return { id: acc.id, type: acc.type, role: data.role as AccountRole, name: acc.name, ready: true };
    },
  });

  const account = data ?? DEFAULT_ACCOUNT;
  const value: AccountContextValue = {
    account,
    isLoading,
    isPersonal: account.type === "personal",
    isBusiness: account.type !== "personal",
    isFleet: account.type === "business_fleet",
    isAgency: account.type === "business_agency",
    can: (min) => ROLE_RANK[account.role] >= ROLE_RANK[min],
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (ctx === undefined) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return ctx;
}
