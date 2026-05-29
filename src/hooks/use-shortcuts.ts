import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

// Linear-style "G D / G P / G C / G E / G A" sequential shortcuts
export function useGoToShortcuts() {
  const navigate = useNavigate();
  const buffer = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const now = Date.now();
      if (buffer.current && now - buffer.current.at < 1000 && buffer.current.key === "g") {
        const map: Record<string, string> = { d: "/dashboard", p: "/pipeline", c: "/contacts", e: "/companies", a: "/activities", r: "/reports" };
        const to = map[k];
        if (to) { e.preventDefault(); navigate({ to }); }
        buffer.current = null;
      } else if (k === "g") {
        buffer.current = { key: "g", at: now };
      } else {
        buffer.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
