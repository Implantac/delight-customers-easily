import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Clock, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Database } from "@/integrations/supabase/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"] & {
  companies: { name: string } | null;
  ai_deal_insights: Database["public"]["Tables"]["ai_deal_insights"]["Row"] | null;
};

export function TopOpportunities() {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["top-opportunities-day"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          companies(name),
          ai_deal_insights(*)
        `)
        .not("stage", "in", "(won,lost)")
        .limit(20);

      if (error) throw error;

      return (data as unknown as Deal[] || []).map((d) => {
        const insights = d.ai_deal_insights;
        const winProb = insights ? Number(insights.win_probability || 0.5) : 0.5;
        
        const daysToClose = d.expected_close 
          ? Math.max(0, (new Date(d.expected_close).getTime() - Date.now()) / (1000 * 3600 * 24))
          : 30;
        const urgencyScore = Math.max(0, 1 - (daysToClose / 60));

        const score = (
          (winProb * 40) + 
          (urgencyScore * 40) + 
          (Math.min(1, Number(d.value || 0) / 100000) * 20)
        );

        return {
          ...d,
          score: Math.round(score),
          winProb: Math.round(winProb * 100),
          urgency: urgencyScore > 0.8 ? "Alta" : urgencyScore > 0.5 ? "Média" : "Baixa",
          daysLeft: Math.round(daysToClose)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    }
  });

  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
          <h3 className="font-semibold text-lg">Top Oportunidades do Dia</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 relative overflow-hidden border-orange-100/50 bg-gradient-to-br from-card to-orange-50/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="bg-orange-100 p-2 rounded-lg">
            <Flame className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg leading-none">Top Oportunidades</h3>
            <p className="text-xs text-muted-foreground mt-1">Ranking por potencial e chance de fechamento</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/pipeline">Ver tudo <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </div>

      <div className="space-y-4">
        {opportunities?.length === 0 ? (
          <p className="text-sm text-center py-8 text-muted-foreground">Nenhuma oportunidade prioritária identificada hoje.</p>
        ) : (
          opportunities?.map((opp, idx) => (
            <Link 
              key={opp.id} 
              to={`/pipeline` as any}
              className="group flex items-center gap-4 p-3 rounded-xl border border-transparent hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300"
            >
              <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-orange-100/50 text-orange-700 font-bold border border-orange-200">
                <span className="text-xs opacity-60">#{idx + 1}</span>
                <span className="text-sm">{opp.score}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-medium text-sm truncate group-hover:text-orange-700 transition-colors">{opp.title}</h4>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-orange-200 text-orange-700 bg-orange-50">
                    {opp.winProb}% Chance
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {opp.companies?.name || "Sem Empresa"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{fmtBRL(Number(opp.value || 0))}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {opp.daysLeft}d
                  </div>
                  <div className={`h-1.5 w-1.5 rounded-full ${opp.urgency === "Alta" ? "bg-red-500" : opp.urgency === "Média" ? "bg-orange-500" : "bg-emerald-500"}`} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

