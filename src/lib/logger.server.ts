/**
 * Logger estruturado server-only. Saída JSON em uma linha para facilitar ingestão
 * em qualquer agregador (Datadog, Logflare, BetterStack, Sentry transport, etc).
 *
 * Quando o usuário cadastrar o SENTRY_DSN (ou outro DSN), basta plugar o transport
 * em `dispatchToSentry` — toda a base de código já chama logger.info/warn/error/event
 * e ganha observabilidade sem mudança adicional.
 */
type Level = "debug" | "info" | "warn" | "error" | "event";

type LogContext = Record<string, unknown> & {
  org_id?: string;
  user_id?: string;
  request_id?: string;
  route?: string;
  duration_ms?: number;
};

function emit(level: Level, message: string, ctx?: LogContext, err?: unknown) {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(ctx ?? {}),
  };
  if (err) {
    if (err instanceof Error) {
      payload.error_name = err.name;
      payload.error_message = err.message;
      payload.error_stack = err.stack;
    } else {
      payload.error_raw = String(err);
    }
  }
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Plug pronto: se SENTRY_DSN estiver definido, encaminhar.
  if ((level === "error" || level === "warn") && process.env.SENTRY_DSN) {
    dispatchToSentry(payload).catch(() => { /* swallow */ });
  }
}

async function dispatchToSentry(_payload: Record<string, unknown>) {
  // TODO: integrar com @sentry/node ou Sentry HTTP transport quando DSN estiver disponível.
  // Mantemos como no-op para não criar dependência até o usuário fornecer o DSN.
}

export const logger = {
  debug: (m: string, ctx?: LogContext) => emit("debug", m, ctx),
  info:  (m: string, ctx?: LogContext) => emit("info", m, ctx),
  warn:  (m: string, ctx?: LogContext, err?: unknown) => emit("warn", m, ctx, err),
  error: (m: string, ctx?: LogContext, err?: unknown) => emit("error", m, ctx, err),
  /** evento de negócio (ex: lead_created, deal_won) para analytics */
  event: (name: string, ctx?: LogContext) => emit("event", name, ctx),
};

/**
 * Wrapper para medir e logar duração de um handler de server function.
 * Uso: return withTiming("route.name", { org_id }, async () => { ... });
 */
export async function withTiming<T>(
  name: string,
  ctx: LogContext,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    logger.info(name, { ...ctx, duration_ms: Date.now() - t0, ok: true });
    return out;
  } catch (e) {
    logger.error(name, { ...ctx, duration_ms: Date.now() - t0, ok: false }, e);
    throw e;
  }
}
