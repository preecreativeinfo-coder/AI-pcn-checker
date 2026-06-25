import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type PCNStatus =
  | "pending"
  | "paid"
  | "contested"
  | "appealed"
  | "cancelled";

export interface AiAnalysis {
  likelihood: "low" | "moderate" | "high";
  score: number; // 0–100 estimated chance of a successful challenge
  summary: string;
  grounds: { title: string; rationale: string }[];
  recommendations: string[];
  generatedAt: string;
  model: string;
}

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
  file_path: string | null;
  ocr_raw_text: string | null;
  ai_analysis: AiAnalysis | null;
  created_at: string;
  updated_at: string;
}

export function usePCNs() {
  const { session } = useAuth();
  
  return useQuery({
    queryKey: ["pcns", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data as PCN[];
    },
    enabled: !!session?.user?.id,
  });
}

export function usePCN(id: string) {
  const { session } = useAuth();
  
  return useQuery({
    queryKey: ["pcns", session?.user?.id, id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();
        
      if (error) throw error;
      return data as PCN;
    },
    enabled: !!session?.user?.id && !!id,
  });
}

export function useCreatePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (pcn: Partial<PCN>) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .insert([{ ...pcn, user_id: session.user.id }])
        .select()
        .single();
        
      if (error) throw error;
      return data as PCN;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id] });
    },
  });
}

export function useDeletePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("pcns")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id] });
    },
  });
}

export function useUpdatePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...pcn }: Partial<PCN> & { id: string }) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pcns")
        .update(pcn)
        .eq("id", id)
        .eq("user_id", session.user.id)
        .select()
        .single();
        
      if (error) throw error;
      return data as PCN;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id, data.id] });
    },
  });
}
