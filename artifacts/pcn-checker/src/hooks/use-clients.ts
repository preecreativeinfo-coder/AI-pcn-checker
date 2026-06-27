import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAccount } from "@/lib/account";

export interface Client {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
}

/** Clients for the current agency account. Only runs for agency accounts. */
export function useClients() {
  const { account } = useAccount();
  return useQuery({
    queryKey: ["clients", account.id],
    enabled: !!account.id && account.type === "business_agency",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("account_id", account.id!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { account } = useAccount();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!account.id) throw new Error("No account");
      const { data, error } = await supabase
        .from("clients")
        .insert({ account_id: account.id, name })
        .select()
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", account.id] }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { account } = useAccount();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", account.id] }),
  });
}
