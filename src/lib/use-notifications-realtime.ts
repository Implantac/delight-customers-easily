import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { getNotificationPrefs, type NotificationPrefs } from "@/lib/notification-prefs.functions";

function inDND(prefs: NotificationPrefs, now = new Date()): boolean {
  if (!prefs.dnd_start || !prefs.dnd_end) return false;
  const [sh, sm] = prefs.dnd_start.split(":").map(Number);
  const [eh, em] = prefs.dnd_end.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {}
}

/**
 * Hook global: escuta novas notificações em tempo real e:
 * - mostra toast (Sonner) sempre, exceto se categoria estiver silenciada / DND ativo
 * - dispara Notification API do navegador se a aba estiver em background
 * - toca beep se sound_enabled
 */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();
  const getPrefsFn = useServerFn(getNotificationPrefs);
  const lastIdRef = useRef<string | null>(null);

  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs", orgId, user?.id],
    queryFn: () => getPrefsFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId && !!user,
    staleTime: 60_000,
  });

  // Pedir permissão do navegador uma vez (sem incomodar)
  useEffect(() => {
    if (prefs?.browser_enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [prefs?.browser_enabled]);

  useEffect(() => {
    if (!user || !orgId) return;
    const ch = supabase
      .channel(`notif-realtime:${user.id}:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const n = payload.new;
          if (!n || lastIdRef.current === n.id) return;
          lastIdRef.current = n.id;

          const p = prefs ?? {
            mute_types: [],
            browser_enabled: true,
            sound_enabled: false,
            dnd_start: null,
            dnd_end: null,
          };
          if (p.mute_types?.includes(n.type)) return;
          if (inDND(p)) return;

          // Toast sempre (visível na app)
          toast(n.title, {
            description: n.body,
            action: n.link
              ? {
                  label: "Ver",
                  onClick: () => navigate({ to: n.link as any }),
                }
              : undefined,
          });

          // Notification API se aba em background
          if (
            p.browser_enabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            try {
              const notif = new Notification(n.title, {
                body: n.body ?? undefined,
                tag: n.id,
                icon: "/favicon.ico",
              });
              notif.onclick = () => {
                window.focus();
                if (n.link) navigate({ to: n.link as any });
                notif.close();
              };
            } catch {}
          }

          if (p.sound_enabled) playBeep();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, orgId, navigate, prefs]);
}
