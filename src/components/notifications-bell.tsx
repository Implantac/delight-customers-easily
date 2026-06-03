import { Bell, Check, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, markAllRead, markRead } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";
import { useNavigate, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: items = [] } = useNotifications();
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="text-sm font-medium">Notificações</p>
          <div className="flex items-center gap-1">
            {unread > 0 && user && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={async () => { await markAllRead(user.id); }}>
                <Check className="h-3 w-3 mr-1" />Marcar todas
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Preferências">
              <Link to="/settings/notifications"><SettingsIcon className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem notificações</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    className={`w-full text-left p-3 hover:bg-accent transition ${!n.read_at ? "bg-accent/30" : ""}`}
                    onClick={async () => { await markRead(n.id); if (n.link) navigate({ to: n.link as any }); }}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
