import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ThreeDLogo } from "@/components/ui/three-d-logo";
import { Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const wantsWelcome =
        typeof window !== "undefined" &&
        window.localStorage.getItem("lc-just-signed-up") === "1";
      if (wantsWelcome) window.localStorage.removeItem("lc-just-signed-up");
      navigate({ to: wantsWelcome ? "/welcome" : "/dashboard", replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/welcome` },
        });
        if (error) throw error;
        if (typeof window !== "undefined") {
          window.localStorage.setItem("lc-just-signed-up", "1");
        }
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  };

  const playEntranceSound = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.2;
      audio.play().catch(e => console.log("Audio play blocked by browser policy"));
    } catch (e) {
      console.log("Audio error");
    }
  };

  useEffect(() => {
    // Tenta tocar o som no primeiro clique do usuário se o mount falhar
    const handleFirstInteraction = () => {
      playEntranceSound();
      window.removeEventListener('mousedown', handleFirstInteraction);
    };
    window.addEventListener('mousedown', handleFirstInteraction);
    return () => window.removeEventListener('mousedown', handleFirstInteraction);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 selection:bg-primary/30">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0ea5e9 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      
      {/* Dynamic Glows */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" 
      />
      <motion.div 
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-violet-500/10 blur-[100px]" 
      />

      <div className="relative w-full max-w-[1400px] flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24">
        
        {/* Left Side: 3D Branding & Welcome Message */}
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={playEntranceSound}
            className="w-full max-w-[500px] mx-auto lg:mx-0 h-[450px]"
          >
            <ThreeDLogo className="h-full w-full" rotationSpeed={0.8} />
          </motion.div>

          <div className="space-y-4 max-w-xl">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-[0.3em]"
            >
              <Sparkles className="h-3 w-3" /> Inteligência de Vendas 3.0
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-4xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.1]"
            >
              Domine seu Mercado <br />
              <span className="text-primary">em Tempo Real.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.8 }}
              className="text-slate-400 text-lg max-w-lg leading-relaxed"
            >
              A Use Patrium transforma seus dados em decisões estratégicas, 
              acelerando o crescimento da sua operação comercial.
            </motion.p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <Card className="border-border/40 bg-slate-950/50 backdrop-blur-2xl p-8 shadow-2xl ring-1 ring-white/10 rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">Acesso Restrito</h2>
              <p className="text-sm text-slate-500 mt-2">Entre com suas credenciais de elite</p>
            </div>

            <div className="mb-6 flex rounded-xl bg-slate-900/50 p-1.5 border border-white/5">
              <button 
                onClick={() => setMode("signin")} 
                className={`flex-1 rounded-lg py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${mode === "signin" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-slate-300"}`}
              >
                Login
              </button>
              <button 
                onClick={() => setMode("signup")} 
                className={`flex-1 rounded-lg py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${mode === "signup" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-slate-300"}`}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Nome Completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: João Patrício"
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20"
                    value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} 
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">E-mail Corporativo</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20"
                  value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Senha Segura</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20"
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} 
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 group transition-all duration-500" disabled={loading}>
                {loading ? "Processando..." : (
                  <span className="flex items-center gap-2">
                    {mode === "signin" ? "Acessar Plataforma" : "Criar Minha Conta"}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
                  <ShieldCheck className="h-3 w-3 text-primary" /> Conexão Segura SSL
               </div>
               <Link to="/" className="text-[10px] text-primary/60 hover:text-primary transition-colors uppercase font-bold tracking-widest">Suporte</Link>
            </div>
          </Card>
        </motion.div>
      </div>

      <p className="absolute bottom-8 text-center text-[10px] text-slate-600 uppercase tracking-[0.5em] font-medium">
        © 2026 USE PATRIUM • ENTERPRISE SOLUTIONS
      </p>
    </div>
  );
}
}
