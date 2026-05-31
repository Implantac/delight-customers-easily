import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Copy } from "lucide-react";
import { draftEmail } from "@/lib/copilot-advanced.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function DraftEmailButton({
  organizationId,
  dealId,
  contactId,
  variant = "outline",
}: {
  organizationId: string;
  dealId?: string;
  contactId?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const fn = useServerFn(draftEmail);
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState<"formal" | "casual" | "consultivo" | "urgente">("consultivo");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const gen = useMutation({
    mutationFn: async () =>
      fn({
        data: {
          organization_id: organizationId,
          deal_id: dealId,
          contact_id: contactId,
          purpose,
          tone,
          language: "pt-BR",
        },
      }),
    onSuccess: (r) => {
      setSubject(r.draft.subject ?? "");
      setBody(r.draft.body ?? "");
      toast.success("Rascunho gerado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <Mail className="h-4 w-4 mr-2" />
          Rascunhar email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rascunho de email com IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Objetivo</Label>
            <Input
              placeholder="Ex.: Follow-up após proposta enviada"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div>
            <Label>Tom</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultivo">Consultivo</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {subject && (
            <>
              <div>
                <Label>Assunto</Label>
                <div className="flex gap-2">
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  <Button size="icon" variant="outline" onClick={() => copy(subject)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Corpo</Label>
                <div className="flex gap-2">
                  <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                  <Button size="icon" variant="outline" onClick={() => copy(body)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={() => gen.mutate()} disabled={!purpose || gen.isPending}>
            {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            {subject ? "Regenerar" : "Gerar com IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
