import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sun, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { getMyBriefingPrefs, upsertBriefingPrefs } from "@/lib/briefing-prefs.functions";

export const Route = createFileRoute("/_app/settings/briefing")({ component: BriefingPrefsPage });

function BriefingPrefsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const callGet = useServerFn(getMyBriefingPrefs);
  const callSave = useServerFn(upsertBriefingPrefs);

  const q = useQuery({
    queryKey: ["briefing-prefs"],
    queryFn: () => callGet(),
  });

  const [channel, setChannel] = useState<"app" | "whatsapp" | "both">("app");
  const [time, setTime] = useState("07:30");
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const p = q.data?.prefs as any;
    if (p) {
      setChannel(p.channel);
      setTime(String(p.send_time).slice(0, 5));
      setPhone(p.whatsapp_phone ?? "");
      setEnabled(p.enabled);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => callSave({
      data: {
        organization_id: orgId!,
        channel,
        send_time: time,
        timezone: "America/Sao_Paulo",
        whatsapp_phone: phone || null,
        enabled,
      },
    }),
    onSuccess: () => {
      toast.success("Preferências salvas");
      qc.invalidateQueries({ queryKey: ["briefing-prefs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <PageHeader
        icon={Sun}
        title="Briefing diário"
        subtitle="Receba seu plano do dia no canal e horário que preferir"
      />

      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativo</Label>
            <p className="text-xs text-muted-foreground">Liga ou desliga o envio diário</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Canal de entrega</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="app">Apenas no app</SelectItem>
              <SelectItem value="whatsapp">Apenas WhatsApp</SelectItem>
              <SelectItem value="both">App + WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Horário</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </Label>
            <Input
              type="tel"
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              disabled={channel === "app"}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
