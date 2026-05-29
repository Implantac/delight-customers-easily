import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { sendCrmEmail } from "@/lib/email.functions";
import { useCurrentOrg } from "@/lib/org";

type Props = {
  to: string;
  contactId?: string;
  dealId?: string;
  triggerLabel?: string;
};

export function SendEmailDialog({ to, contactId, dealId, triggerLabel = "Enviar e-mail" }: Props) {
  const send = useServerFn(sendCrmEmail);
  const { orgId } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    if (!orgId || !to || !subject || !body) return toast.error("Preencha todos os campos");
    setLoading(true);
    try {
      await send({ data: {
        to, subject,
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.5">${body.replace(/\n/g, "<br/>")}</div>`,
        contact_id: contactId, deal_id: dealId, organization_id: orgId,
      } });
      toast.success("E-mail enviado e registrado como atividade");
      setOpen(false); setSubject(""); setBody("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!to}><Mail className="h-4 w-4 mr-1" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar e-mail</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Para</Label><Input value={to} disabled /></div>
          <div className="space-y-1.5"><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Mensagem</Label><Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={onSend} disabled={loading}>{loading ? "Enviando…" : "Enviar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
