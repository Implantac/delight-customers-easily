import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark" | "system" | "use-sistemas";
type Ctx = { theme: Theme; resolved: "light" | "dark" | "use-sistemas"; setTheme: (t: Theme) => void };

const ThemeCtx = createContext<Ctx>({ theme: "system", resolved: "light", setTheme: () => {} });

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return "light" as const;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // Clean all custom theme classes
  root.classList.remove("dark", "use-sistemas");
  
  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  
  if (resolved === "dark") root.classList.add("dark");
  if (resolved === "use-sistemas") root.classList.add("use-sistemas");

  // Sync mobile/PWA status bar with the active theme
  const color = resolved === "dark" ? "#181d2e" : resolved === "use-sistemas" ? "#0f172a" : "#ffffff";
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("crm-theme") as Theme) || "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark" | "use-sistemas">("light");
  const loadedFromServer = useRef(false);

  // Hydrate from user profile (DB) once, falling back to localStorage
  useEffect(() => {
    if (loadedFromServer.current) return;
    loadedFromServer.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", user.id)
          .maybeSingle();
        const t = (data?.theme_preference as Theme | undefined);
        if (t && t !== theme) {
          localStorage.setItem("crm-theme", t);
          setThemeState(t);
        }
      } catch {/* ignore */}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setResolved(applyTheme(theme));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (theme === "system") setResolved(applyTheme("system")); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem("crm-theme", t);
    setThemeState(t);
    // Persist to profile (best-effort; ignore errors when logged out)
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("profiles").update({ theme_preference: t }).eq("id", user.id);
      } catch {/* ignore */}
    })();
  };

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
