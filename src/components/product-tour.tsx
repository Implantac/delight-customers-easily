/**
 * Tour guiado leve — spotlight + tooltip sobre elementos da UI.
 * Sem dependências externas. Estado persistido em localStorage por usuário.
 *
 * Uso:
 *   <ProductTour
 *     tourId="dashboard-v1"
 *     steps={[
 *       { selector: '[data-tour="sidebar-pipeline"]', title: 'Pipeline', body: '...' },
 *       ...
 *     ]}
 *   />
 *
 * Só dispara automaticamente se não foi concluído/dispensado.
 */
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
};

type Props = {
  tourId: string;
  steps: TourStep[];
  autoStart?: boolean;
};

const storageKey = (id: string) => `tour:done:${id}`;

export function isTourDone(tourId: string): boolean {
  try {
    return localStorage.getItem(storageKey(tourId)) === "1";
  } catch {
    return false;
  }
}

export function markTourDone(tourId: string) {
  try {
    localStorage.setItem(storageKey(tourId), "1");
  } catch {
    /* ignore */
  }
}

export function resetTour(tourId: string) {
  try {
    localStorage.removeItem(storageKey(tourId));
  } catch {
    /* ignore */
  }
}

export function ProductTour({ tourId, steps, autoStart = true }: Props) {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoStart) return;
    if (isTourDone(tourId)) return;
    // espera 600ms para a UI montar
    const t = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(t);
  }, [tourId, autoStart]);

  const measure = useCallback(() => {
    if (!active) return;
    const step = steps[idx];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    // garante visibilidade
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    rafRef.current = requestAnimationFrame(() => {
      setRect(el.getBoundingClientRect());
    });
  }, [active, idx, steps]);

  useLayoutEffect(() => {
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  if (!active) return null;
  const step = steps[idx];
  if (!step) return null;

  const finish = () => {
    markTourDone(tourId);
    setActive(false);
  };

  const next = () => {
    if (idx >= steps.length - 1) finish();
    else setIdx((i) => i + 1);
  };
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  // Calcula posição do tooltip
  let tipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 10001,
    maxWidth: 340,
  };
  if (rect) {
    const pad = 12;
    const placement = step.placement ?? "auto";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const place =
      placement === "auto"
        ? rect.bottom + 200 < vh
          ? "bottom"
          : "top"
        : placement;
    if (place === "bottom") {
      tipStyle.top = rect.bottom + pad;
      tipStyle.left = Math.min(Math.max(rect.left, 12), vw - 352);
    } else if (place === "top") {
      tipStyle.bottom = vh - rect.top + pad;
      tipStyle.left = Math.min(Math.max(rect.left, 12), vw - 352);
    } else if (place === "right") {
      tipStyle.top = Math.max(12, rect.top);
      tipStyle.left = rect.right + pad;
    } else {
      tipStyle.top = Math.max(12, rect.top);
      tipStyle.right = vw - rect.left + pad;
    }
  } else {
    // sem elemento: centraliza
    tipStyle.top = "50%";
    tipStyle.left = "50%";
    tipStyle.transform = "translate(-50%, -50%)";
  }

  // Spotlight: overlay com "buraco" via box-shadow
  const hole = rect
    ? {
        position: "fixed" as const,
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        borderRadius: 8,
        zIndex: 10000,
        pointerEvents: "none" as const,
        transition: "all 200ms ease",
        outline: "2px solid hsl(var(--primary))",
      }
    : null;

  const overlay = (
    <>
      {hole ? (
        <div style={hole} />
      ) : (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 10000,
          }}
        />
      )}
      <div
        style={tipStyle}
        className="rounded-lg border bg-popover text-popover-foreground shadow-2xl p-4 w-[340px]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold">{step.title}</h3>
          </div>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {idx + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            {idx > 0 && (
              <Button size="sm" variant="ghost" onClick={prev}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {idx >= steps.length - 1 ? "Concluir" : "Próximo"}
              {idx < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
