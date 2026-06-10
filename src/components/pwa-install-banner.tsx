import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

/**
 * Banner discreto que aparece em mobile quando o navegador detecta
 * que o app pode ser instalado. Dispensável e respeita o "não me mostre
 * de novo" por 14 dias.
 */
export function PwaInstallBanner() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Já instalado (standalone)?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS
      (navigator as any).standalone === true;
    if (standalone) return;

    // Já dispensou recentemente?
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !evt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    setVisible(false);
  };

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md">
      <Card className="p-3 flex items-center gap-3 shadow-lg border-primary/40 bg-card/95 backdrop-blur">
        <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Instalar como app</p>
          <p className="text-xs text-muted-foreground">Acesso rápido, tela cheia, sem abrir navegador.</p>
        </div>
        <Button size="sm" onClick={install}>Instalar</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dispensar">
          <X className="h-4 w-4" />
        </Button>
      </Card>
    </div>
  );
}
