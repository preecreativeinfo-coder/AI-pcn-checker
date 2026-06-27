import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";

export interface Vehicle {
  id: string;
  user_id: string;
  registration_number: string;
  make: string;
  model: string;
  colour: string | null;
  vehicle_type: string | null;
  client_id: string | null;
  created_at: string;
}

export interface VehicleInput {
  registration_number: string;
  make: string;
  model: string;
  colour?: string | null;
  vehicle_type?: string | null;
  client_id?: string | null;
}

export function useVehicles() {
  const { session } = useAuth();
  const { account } = useAccount();
  const userId = session?.user?.id;
  const scope = account.id ?? userId;

  return useQuery({
    queryKey: ["vehicles", scope],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      query = account.id ? query.eq("account_id", account.id) : query.eq("user_id", userId!);
      const { data, error } = await query;
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async (vehicle: VehicleInput) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("vehicles")
        .insert([{ ...vehicle, user_id: session.user.id, account_id: account.id ?? null }])
        .select()
        .single();

      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", scope] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<VehicleInput> & { id: string }) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("vehicles")
        .update(fields)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", scope] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { account } = useAccount();
  const scope = account.id ?? session?.user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", scope] });
    },
  });
}
