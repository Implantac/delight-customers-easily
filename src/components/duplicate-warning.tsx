import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { findContactDuplicates, findCompanyDuplicates, type ContactDup, type CompanyDup } from "@/lib/dedup";

export function ContactDuplicateWarning({ name, email, phone }: { name?: string; email?: string; phone?: string }) {
  const [dups, setDups] = useState<ContactDup[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!name && !email && !phone) { setDups([]); return; }
      setDups(await findContactDuplicates({ name, email, phone }));
    }, 350);
    return () => clearTimeout(t);
  }, [name, email, phone]);
  if (dups.length === 0) return null;
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-warning"><AlertTriangle className="h-3.5 w-3.5" />Possível duplicata</div>
      <ul className="mt-1.5 space-y-1">
        {dups.map((d) => (
          <li key={d.id}>
            <Link to="/contacts/$id" params={{ id: d.id }} className="text-primary hover:underline">{d.name}</Link>
            <span className="text-muted-foreground"> — {d.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompanyDuplicateWarning({ name, website }: { name?: string; website?: string }) {
  const [dups, setDups] = useState<CompanyDup[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!name) { setDups([]); return; }
      setDups(await findCompanyDuplicates({ name, website }));
    }, 350);
    return () => clearTimeout(t);
  }, [name, website]);
  if (dups.length === 0) return null;
  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-warning"><AlertTriangle className="h-3.5 w-3.5" />Possível duplicata</div>
      <ul className="mt-1.5 space-y-1">
        {dups.map((d) => (
          <li key={d.id}>
            <Link to="/companies/$id" params={{ id: d.id }} className="text-primary hover:underline">{d.name}</Link>
            <span className="text-muted-foreground"> — {d.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
