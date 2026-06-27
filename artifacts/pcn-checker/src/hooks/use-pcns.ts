import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";

export type PCNStatus =
  | "pending"
  | "paid"
  | "contested"
  | "appealed"
  | "cancelled";

export interface PCN {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  pcn_reference: string;
  issuer: string;
  issue_date: string | null;
  amount: number | null;
  status: PCNStatus;
  due_date: string | null;
  location: string | null;
  contravention_code: string | null;
  contravention_time: string | null;
  file_path: string | null;
  ocr_raw_text: string | null;
  created_at: string;
  updated_at: string;
}

export function usePCNs() {
  const { session } = useAuth();
  const { account } = useAccount();
  const userId = session?.user?.id;
  // Scope to the account once it's loaded; fall back to the user while it loads
  // (and pre-migration). RLS enforces the real boundary either way.
  const scope = account.id ?? userId;

  return useQuery({
    queryKey: ["pcns", scope],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase.from("pcns").select("*").order("created_at", { ascending: false });
      query = account.id ? query.eq("account_id", account.id) : query.eq("user_id", userId!);
      const { data, error } = await query;
      if (error) throw error;
      return data as PCN[];
    },
  });
}

export function usePCN(id: string) {
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useQuery({
    queryKey: ["pcns", scope, id],
    enabled: !!session?.user?.id && !!id,
    queryFn: async () => {
      // Filter by id only — RLS restricts visibility to the user's account.
      const { data, error } = await supabase.from("pcns").select("*").eq("id", id).single();
      if (error) throw error;
      return data as PCN;
    },
  });
}

export function useCreatePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async (pcn: Partial<PCN>) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .insert([{ ...pcn, user_id: session.user.id, account_id: account.id ?? null }])
        .select()
        .single();
      if (error) throw error;
      return data as PCN;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcns", scope] });
    },
  });
}

export function useDeletePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("pcns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcns", scope] });
    },
  });
}

export function useUpdatePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async ({ id, ...pcn }: Partial<PCN> & { id: string }) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .update(pcn)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as PCN;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pcns", scope] });
      queryClient.invalidateQueries({ queryKey: ["pcns", scope, data.id] });
    },
  });
}
