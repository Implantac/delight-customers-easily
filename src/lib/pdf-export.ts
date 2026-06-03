/**
 * Geração de PDFs comerciais client-side com jsPDF + autoTable.
 * Não é ERP — apenas exporta dados comerciais já existentes no CRM
 * (proposta, relatório de visita do representante).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};
const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
};

// ------------------------------------------------------------------
// PROPOSTA
// ------------------------------------------------------------------
export type ProposalPdfInput = {
  orgName?: string;
  proposalTitle: string;
  proposalNumber?: string | number | null;
  status?: string | null;
  validUntil?: string | null;
  customerName?: string | null;
  notes?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number | null;
  }>;
  subtotal: number;
  discountPercent?: number;
  total: number;
};

export function downloadProposalPdf(input: ProposalPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.orgName || "Proposta Comercial", margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Emitida em ${new Date().toLocaleDateString("pt-BR")}`,
    pageW - margin,
    50,
    { align: "right" },
  );

  // Linha
  doc.setDrawColor(220);
  doc.line(margin, 60, pageW - margin, 60);

  // Bloco proposta
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(input.proposalTitle, margin, 84);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 102;
  const meta: Array<[string, string]> = [
    ["Cliente", input.customerName || "—"],
    ["Status", input.status || "—"],
    ["Válida até", fmtDate(input.validUntil)],
  ];
  if (input.proposalNumber != null) meta.unshift(["Nº", String(input.proposalNumber)]);
  for (const [k, v] of meta) {
    doc.setTextColor(120);
    doc.text(`${k}:`, margin, y);
    doc.setTextColor(0);
    doc.text(v, margin + 60, y);
    y += 14;
  }

  // Tabela itens
  autoTable(doc, {
    startY: y + 10,
    margin: { left: margin, right: margin },
    head: [["Descrição", "Qtd", "Preço unit.", "Desc %", "Subtotal"]],
    body: input.items.map((it) => {
      const line = Number(it.quantity) * Number(it.unit_price);
      const sub = line * (1 - Number(it.discount_percent || 0) / 100);
      return [
        it.description,
        String(it.quantity),
        BRL(Number(it.unit_price)),
        `${Number(it.discount_percent || 0)}%`,
        BRL(sub),
      ];
    }),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  // Totais
  // @ts-expect-error - lastAutoTable é injetado pelo autoTable
  const tableEndY: number = doc.lastAutoTable?.finalY ?? y + 100;
  let ty = tableEndY + 20;
  const rightX = pageW - margin;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Subtotal", rightX - 120, ty);
  doc.setTextColor(0);
  doc.text(BRL(input.subtotal), rightX, ty, { align: "right" });
  ty += 14;
  if (input.discountPercent && input.discountPercent > 0) {
    doc.setTextColor(120);
    doc.text("Desconto global", rightX - 120, ty);
    doc.setTextColor(0);
    doc.text(`${input.discountPercent}%`, rightX, ty, { align: "right" });
    ty += 14;
  }
  doc.setDrawColor(220);
  doc.line(rightX - 160, ty, rightX, ty);
  ty += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", rightX - 120, ty);
  doc.text(BRL(input.total), rightX, ty, { align: "right" });

  // Observações
  if (input.notes && input.notes.trim()) {
    ty += 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações", margin, ty);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(input.notes, pageW - margin * 2);
    doc.text(split, margin, ty + 14);
  }

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Gerado pelo CRM", margin, pageH - 20);

  const fname = `proposta-${(input.proposalNumber ?? input.proposalTitle).toString().replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40)}.pdf`;
  doc.save(fname);
}

// ------------------------------------------------------------------
// RELATÓRIO DE VISITA(S)
// ------------------------------------------------------------------
export type VisitReportInput = {
  orgName?: string;
  repName?: string | null;
  periodLabel: string;
  visits: Array<{
    title: string;
    when?: string | null;
    contactName?: string | null;
    companyName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
  }>;
};

export function downloadVisitReportPdf(input: VisitReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de Visitas", margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(input.orgName || "", pageW - margin, 50, { align: "right" });

  doc.setDrawColor(220);
  doc.line(margin, 60, pageW - margin, 60);

  doc.setTextColor(0);
  doc.setFontSize(10);
  let y = 82;
  doc.text(`Representante: ${input.repName || "—"}`, margin, y);
  y += 14;
  doc.text(`Período: ${input.periodLabel}`, margin, y);
  y += 14;
  doc.text(`Total de visitas: ${input.visits.length}`, margin, y);

  autoTable(doc, {
    startY: y + 16,
    margin: { left: margin, right: margin },
    head: [["Quando", "Cliente / Contato", "Local (GPS)", "Observações"]],
    body: input.visits.map((v) => [
      fmtDateTime(v.when),
      [v.companyName, v.contactName].filter(Boolean).join(" / ") || "—",
      v.latitude != null && v.longitude != null
        ? `${v.latitude.toFixed(5)}, ${v.longitude.toFixed(5)}`
        : "—",
      v.notes || "—",
    ]),
    styles: { fontSize: 8.5, cellPadding: 5, valign: "top" },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    columnStyles: { 0: { cellWidth: 110 }, 2: { cellWidth: 110 } },
  });

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} • CRM`,
    margin,
    pageH - 20,
  );

  const fname = `relatorio-visitas-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
