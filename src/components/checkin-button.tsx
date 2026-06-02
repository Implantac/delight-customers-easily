import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/lib/org";
import { createCheckin } from "@/lib/checkin.functions";

/**
 * Botão "Check-in agora" para o representante em campo.
 * Lê a geolocation do dispositivo e registra uma activity tipo visita.
 */
export function CheckinButton({
  contactId,
  size = "sm",
  className,
}: {
  contactId?: string | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const callFn = useServerFn(createCheckin);
  const [locating, setLocating] = useState(false);

  const m = useMutation({
    mutationFn: (geo: { lat: number | null; lng: number | null; acc: number | null }) =>
      callFn({
        data: {
          organization_id: orgId!,
          contact_id: contactId ?? null,
          title: "Check-in",
          latitude: geo.lat,
          longitude: geo.lng,
          accuracy_m: geo.acc,
        },
      }),
    onSuccess: () => {
      toast.success("Check-in registrado!");
      qc.invalidateQueries({ queryKey: ["my-day-tasks"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no check-in"),
  });

  const handleClick = () => {
    if (!orgId) return;
    if (!("geolocation" in navigator)) {
      m.mutate({ lat: null, lng: null, acc: null });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        m.mutate({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy ?? null,
        });
      },
      (err) => {
        setLocating(false);
        toast.warning("Sem GPS — registrando check-in sem localização.", {
          description: err.message,
        });
        m.mutate({ lat: null, lng: null, acc: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  };

  const busy = locating || m.isPending;

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={busy || !orgId}
      className={className}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <MapPin className="h-4 w-4 mr-1.5" />}
      {busy ? "Localizando…" : "Cheguei (Check-in)"}
    </Button>
  );
}
