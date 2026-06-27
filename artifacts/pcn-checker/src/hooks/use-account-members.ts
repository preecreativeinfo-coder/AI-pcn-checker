import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAccount, type AccountRole } from "@/lib/account";

export interface AccountMember {
  account_id: string;
  user_id: string;
  role: AccountRole;
  created_at: string;
}

/**
 * Members of the current (business) account. Read-only for now — changing
 * roles / removing members and email-based invites need the phase-3 RLS
 * policies + a profiles table, tracked separately.
 */
export function useAccountMembers() {
  const { account } = useAccount();
  return useQuery({
    queryKey: ["account-members", account.id],
    enabled: !!account.id && account.type !== "personal",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_users")
        .select("*")
        .eq("account_id", account.id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AccountMember[];
    },
  });
}
