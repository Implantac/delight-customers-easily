import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ShieldCheck, CheckSquare, ListChecks, FileWarning, Search, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/qa")({ component: QAPage });

function QAPage() {
  const tests = [
    { id: "QA-901", module: "Automação WhatsApp", type: "Integração", status: "Passou", lastRun: "10m atrás" },
    { id: "QA-905", module: "Dashboard Executivo", type: "Performance", status: "Alerta", lastRun: "1h atrás" },
    { id: "QA-908", module: "Cadastro CNPJ", type: "Funcional", status: "Falhou", lastRun: "Agora" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Q.A & Qualidade"
        subtitle="Controle de qualidade de implementações, testes de software e validação de dados."
        icon={Microscope}
        action={<Button><CheckSquare className="mr-2 h-4 w-4" />Nova Inspeção</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Testes Realizados (Mês)" value="1.240" icon={ListChecks} color="text-blue-500" />
        <StatCard label="Taxa de Sucesso" value="94.2%" icon={ShieldCheck} color="text-emerald-500" />
        <StatCard label="Issues Reportadas" value="18" icon={FileWarning} color="text-rose-500" />
      </div>

      <Card className="border-border/40 overflow-hidden">
        <div className="p-6 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Relatório de Inspeção Recente
          </h3>
          <Button variant="ghost" size="sm" className="text-xs h-8">Ver Histórico Completo</Button>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Última Execução</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/10 transition-colors cursor-pointer">
                <TableCell className="font-mono text-xs font-bold">{t.id}</TableCell>
                <TableCell className="font-medium">{t.module}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      t.status === "Passou" ? "bg-emerald-500" : 
                      t.status === "Alerta" ? "bg-amber-500" : "bg-rose-500"
                    }`} />
                    <span className="text-xs font-medium">{t.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{t.lastRun}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
    </Card>
  );
}
