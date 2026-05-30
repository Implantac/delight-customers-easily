import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Mantém dados frescos por 30s — evita refetch agressivo ao trocar de rota
        staleTime: 30_000,
        // Mantém em cache por 5min após desuso (gc)
        gcTime: 5 * 60_000,
        // Não refaz fetch ao voltar para a aba — UX muito mais fluida
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
        // Retry mínimo (1 tentativa) reduz latência aparente em erros
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega rota ao passar o mouse / focar o link — navegação ~instantânea
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // Router controla seu próprio cache; deixa o React Query mandar na frescor dos dados
    defaultPreloadStaleTime: 0,
    // Suaviza piscadas: só mostra pending após 200ms, mas garante visibilidade mínima de 400ms
    defaultPendingMs: 200,
    defaultPendingMinMs: 400,
  });

  return router;
};
