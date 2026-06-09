import { useState } from "react";
import { Search, Loader2, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  cnae_fiscal_descricao: string;
  ddd_telefone_1: string;
  email: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
}

interface CnpjSearchProps {
  onSuccess: (data: Partial<CnpjData>) => void;
}

export function CnpjSearch({ onSuccess }: CnpjSearchProps) {
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ inválido. Insira 14 números.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();
      
      onSuccess({
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social,
        cnpj: data.cnpj,
        cnae_fiscal_descricao: data.cnae_fiscal_descricao,
        email: data.email,
        municipio: data.municipio,
        uf: data.uf,
      });
      
      toast.success("Dados recuperados com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar CNPJ. Verifique se o número está correto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Buscar por CNPJ (Preenchimento Automático)</label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="pl-9 h-11 bg-muted/50 border-primary/10 focus:border-primary/30 transition-all"
          />
        </div>
      </div>
      <Button 
        type="button" 
        onClick={handleSearch} 
        disabled={loading || cnpj.length < 14}
        className="h-11 px-6 font-bold shadow-lg shadow-primary/10"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
        Buscar
      </Button>
    </div>
  );
}