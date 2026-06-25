import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface Toll {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  description: string;
  amount: number;
  charge_date: string | null;
  location: string | null;
  created_at: string;
}

export function useTolls() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["tolls", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tolls")
        .select("*")
        .eq("user_id", session.user.id)
        .order("charge_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Toll[];
    },
    enabled: !!session?.user?.id,
  });
}

export function useCreateToll() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (toll: Omit<Toll, "id" | "user_id" | "created_at">) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tolls")
        .insert([{ ...toll, user_id: session.user.id }])
        .select()
        .single();

      if (error) throw error;
      return data as Toll;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tolls", session?.user?.id] });
    },
  });
}

export function useDeleteToll() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("tolls")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tolls", session?.user?.id] });
    },
  });
}
