import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { whatsappLink } from "@/lib/wa";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Phone, Mail, CalendarPlus, StickyNote, KanbanSquare, Loader2, Zap,
} from "lucide-react";

/**
 * QuickActionsDock — dock flutuante (sticky bottom-right) com as ações canônicas
 * do vendedor sobre um cliente: WhatsApp, Ligar, Email, Agendar, Nota, Oportunidade.
 * Segue a regra "2 cliques": ação principal em 1 clique quando o dado permite;
 * agendar/nota abrem popover mínimo com submit em Enter.
 * Usado em Customer 360 (empresa/contato).
 */
export type QuickActionsDockProps = {
  organizationId: string;
  companyId?: string | null;
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  /** Rota destino ao criar oportunidade. Default: /pipeline */
  newDealHref?: string;
};

export function QuickActionsDock({
  organizationId,
  companyId,
  contactId,
  phone,
  email,
  name,
  newDealHref = "/pipeline",
}: QuickActionsDockProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [noteText, setNoteText] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["company-activities"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["timeline"] });
    qc.invalidateQueries({ queryKey: ["customer-360-timeline"] });
  };

  const createTask = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      const title = taskTitle.trim() || `Visita a ${name ?? "cliente"}`;
      const { error } = await supabase.from("activities").insert({
        user_id: user.id,
        organization_id: organizationId,
        company_id: companyId ?? null,
        contact_id: contactId ?? null,
        type: "meeting",
        title,
        due_date: taskDate ? new Date(taskDate).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita agendada");
      setScheduleOpen(false);
      setTaskTitle("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createNote = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      const text = noteText.trim();
      if (!text) throw new Error("Escreva a nota");
      const { error } = await supabase.from("activities").insert({
        user_id: user.id,
        organization_id: organizationId,
        company_id: companyId ?? null,
        contact_id: contactId ?? null,
        type: "note",
        title: text.slice(0, 80),
        description: text.length > 80 ? text : null,
        completed: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota registrada");
      setNoteOpen(false);
      setNoteText("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const waHref = phone ? whatsappLink(phone) : null;
  const telHref = phone ? `tel:${phone.replace(/\D/g, "")}` : null;
  const mailHref = email ? `mailto:${email}` : null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full",
        "border border-border/60 bg-card/95 p-1.5 shadow-xl backdrop-blur-md",
        "supports-[backdrop-filter]:bg-card/80",
      )}
      role="toolbar"
      aria-label="Ações rápidas do cliente"
    >
      <div className="hidden pl-2 pr-1 sm:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Zap className="h-3 w-3 text-primary" /> Ação
      </div>

      <DockButton
        icon={MessageCircle}
        label="WhatsApp"
        tone="whatsapp"
        disabled={!waHref}
        href={waHref ?? undefined}
        external
      />
      <DockButton
        icon={Phone}
        label="Ligar"
        tone="call"
        disabled={!telHref}
        href={telHref ?? undefined}
        external
      />
      <DockButton
        icon={Mail}
        label="Email"
        tone="email"
        disabled={!mailHref}
        href={mailHref ?? undefined}
        external
      />

      <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Agendar visita ou reunião"
            aria-label="Agendar visita"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition-colors",
              "text-violet-600 hover:bg-violet-500/10",
            )}
          >
            <CalendarPlus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-72 p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); createTask.mutate(); }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <CalendarPlus className="h-3.5 w-3.5 text-violet-600" /> Agendar visita
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Título</Label>
              <Input
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={name ? `Visita a ${name}` : "Visita ao cliente"}
                maxLength={150}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="h-8"
              />
            </div>
            <Button type="submit" size="sm" className="w-full h-8" disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Agendar"}
            </Button>
          </form>
        </PopoverContent>
      </Popover>

      <Popover open={noteOpen} onOpenChange={setNoteOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Registrar nota rápida"
            aria-label="Nota rápida"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition-colors",
              "text-amber-600 hover:bg-amber-500/10",
            )}
          >
            <StickyNote className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80 p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); createNote.mutate(); }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <StickyNote className="h-3.5 w-3.5 text-amber-600" /> Nova nota
            </div>
            <Textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  createNote.mutate();
                }
              }}
              placeholder="Ex: cliente pediu proposta com desconto de 5%…"
              maxLength={1000}
              rows={4}
              className="text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter</span>
              <Button type="submit" size="sm" className="h-8" disabled={createNote.isPending || !noteText.trim()}>
                {createNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      <div className="mx-0.5 h-6 w-px bg-border/60" />

      <Button asChild size="sm" className="h-9 gap-1.5 rounded-full px-3 shadow-sm">
        <Link to={newDealHref as any}>
          <KanbanSquare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Oportunidade</span>
        </Link>
      </Button>
    </div>
  );
}

function DockButton({
  icon: Icon, label, tone, href, external, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "whatsapp" | "call" | "email";
  href?: string;
  external?: boolean;
  disabled?: boolean;
}) {
  const toneCls =
    tone === "whatsapp" ? "text-emerald-600 hover:bg-emerald-500/10"
    : tone === "call"   ? "text-sky-600 hover:bg-sky-500/10"
    :                     "text-blue-600 hover:bg-blue-500/10";
  const base = cn(
    "grid h-9 w-9 place-items-center rounded-full transition-colors",
    disabled ? "text-muted-foreground/40 cursor-not-allowed" : toneCls,
  );
  if (disabled || !href) {
    return (
      <span className={base} title={`${label} indisponível — sem contato`} aria-disabled>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      title={label}
      aria-label={label}
      className={base}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}
