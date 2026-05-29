import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Notification = {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export async function markAllRead(userId: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", userId).is("read_at", null);
}

export async function markRead(id: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}
