import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface Vehicle {
  id: string;
  user_id: string;
  registration_number: string;
  make: string;
  model: string;
  created_at: string;
}

export function useVehicles() {
  const { session } = useAuth();
  
  return useQuery({
    queryKey: ["vehicles", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!session?.user?.id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (vehicle: Omit<Vehicle, "id" | "user_id" | "created_at">) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("vehicles")
        .insert([{ ...vehicle, user_id: session.user.id }])
        .select()
        .single();
        
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", session?.user?.id] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", session?.user?.id] });
    },
  });
}
