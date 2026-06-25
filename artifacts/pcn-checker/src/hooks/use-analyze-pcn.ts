import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { contraventionDescription } from "@/lib/contravention-codes";
import type { AiAnalysis, PCN } from "@/hooks/use-pcns";

// In dev the analysis runs through the local Express server; in production it's
// a same-origin Vercel function. Mirrors the base-URL logic in main.tsx.
const API_BASE = import.meta.env.DEV ? "http://localhost:3001" : "";

export function useAnalyzePCN() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (pcn: PCN): Promise<AiAnalysis> => {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pcn_reference: pcn.pcn_reference,
          issuer: pcn.issuer,
          issue_date: pcn.issue_date,
          due_date: pcn.due_date,
          amount: pcn.amount,
          location: pcn.location,
          contravention_code: pcn.contravention_code,
          contravention_desc: contraventionDescription(pcn.contravention_code),
          ocr_raw_text: pcn.ocr_raw_text,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed (HTTP ${res.status})`);
      }

      const analysis = (await res.json()) as AiAnalysis;

      // Cache the result on the row so revisiting doesn't re-run (and re-bill) it.
      if (session?.user?.id) {
        await supabase
          .from("pcns")
          .update({ ai_analysis: analysis })
          .eq("id", pcn.id)
          .eq("user_id", session.user.id);
      }
      return analysis;
    },
    onSuccess: (_data, pcn) => {
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id] });
      queryClient.invalidateQueries({ queryKey: ["pcns", session?.user?.id, pcn.id] });
    },
  });
}
