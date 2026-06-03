import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Volume2, MoonStar, BellOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notification-prefs.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/settings/notifications")({
  component: NotificationSettingsPage,
});

// Categorias conhecidas (de alerts.functions.ts e notificações do sistema)
const KNOWN_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "alert.stale_deal", label: "Negócios parados" },
  { key: "alert.silent_contact", label: "Clientes silenciosos" },
  { key: "alert.overdue_task", label: "Tarefas atrasadas" },
  { key: "alert.closing_soon", label: "Fechamento próximo" },
  { key: "alert.high_value_idle", label: "Alto valor sem ação" },
  { key: "message", label: "Mensagens internas" },
  { key: "mention", label: "Menções" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "lead", label: "Novos leads" },
  { key: "automation", label: "Automações" },
];

function NotificationSettingsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationPrefs);
  const updateFn = useServerFn(updateNotificationPrefs);

  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs", orgId],
    queryFn: () => getFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [mute, setMute] = useState<string[]>([]);
  const [browser, setBrowser] = useState(true);
  const [sound, setSound] = useState(false);
  const [dndStart, setDndStart] = useState("");
  const [dndEnd, setDndEnd] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof Notification === "undefined") setPermission("unsupported");
    else setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!prefs) return;
    setMute(prefs.mute_types ?? []);
    setBrowser(prefs.browser_enabled);
    setSound(prefs.sound_enabled);
    setDndStart(prefs.dnd_start ?? "");
    setDndEnd(prefs.dnd_end ?? "");
  }, [prefs]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          organization_id: orgId!,
          mute_types: mute,
          browser_enabled: browser,
          sound_enabled: sound,
          dnd_start: dndStart || null,
          dnd_end: dndEnd || null,
        },
      }),
    onSuccess: () => {
      toast.success("Preferências salvas");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e?.message }),
  });

  const toggleMute = (key: string) =>
    setMute((curr) => (curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]));

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notificações do navegador ativadas");
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        icon={Bell}
        title="Preferências de notificação"
        subtitle="Controle o que você recebe, como e quando"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Entrega</CardTitle>
          <CardDescription>Como as notificações chegam até você</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Notificações do navegador</Label>
              <p className="text-xs text-muted-foreground">Aparecem fora da aba do CRM (precisa de permissão do navegador)</p>
            </div>
            <Switch checked={browser} onCheckedChange={setBrowser} />
          </div>

          {browser && permission !== "granted" && permission !== "unsupported" && (
            <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-xs">Permissão do navegador: <Badge variant="outline">{permission}</Badge></p>
              <Button size="sm" variant="outline" onClick={requestPermission}>Permitir</Button>
            </div>
          )}
          {permission === "unsupported" && (
            <p className="text-xs text-muted-foreground">Seu navegador não suporta Notification API.</p>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm flex items-center gap-1"><Volume2 className="h-3 w-3" /> Som ao receber</Label>
              <p className="text-xs text-muted-foreground">Toca um beep curto</p>
            </div>
            <Switch checked={sound} onCheckedChange={setSound} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MoonStar className="h-4 w-4" /> Não perturbe</CardTitle>
          <CardDescription>Silencia notificações em um intervalo do dia</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="time" value={dndStart} onChange={(e) => setDndStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={dndEnd} onChange={(e) => setDndEnd(e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Deixe ambos vazios para desativar.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellOff className="h-4 w-4" /> Silenciar categorias</CardTitle>
          <CardDescription>Notificações dessas categorias não geram toast nem alerta do navegador</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {KNOWN_CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div>
                <Label className="text-sm">{c.label}</Label>
                <p className="text-[11px] text-muted-foreground font-mono">{c.key}</p>
              </div>
              <Switch
                checked={!mute.includes(c.key)}
                onCheckedChange={() => toggleMute(c.key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          Salvar preferências
        </Button>
      </div>
    </div>
  );
}
