import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Calendar as CalIcon } from "lucide-react";
import { getArticle } from "@/lib/kb.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/kb/$id")({
  component: ArticlePage,
});

function ArticlePage() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getArticle);
  const { data, isLoading } = useQuery({
    queryKey: ["kb-article", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  const a = data?.article;

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to="/kb">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
      </Button>

      {isLoading || !a ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{a.title}</h1>
            <div className="flex items-center gap-3 mt-3 flex-wrap text-sm text-muted-foreground">
              {a.category && <Badge variant="outline">{a.category}</Badge>}
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" /> {a.views} visualizações
              </span>
              <span className="flex items-center gap-1">
                <CalIcon className="h-4 w-4" />
                {formatDistanceToNow(new Date(a.updated_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              {(a.tags ?? []).map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  #{t}
                </Badge>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                {a.content || (
                  <p className="text-muted-foreground italic">
                    (Artigo sem conteúdo)
                  </p>
                )}
              </article>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
