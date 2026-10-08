import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { classifyInfraError, infraMessage } from "./infra-errors";

type Ctx = { params: Promise<Record<string, string>> };

/** Uniform JSON error contract: { error: { code, message, details? } }. */
export function route(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Defence in depth on top of SameSite=Lax: reject state-changing requests whose Origin is not this site. */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (cron, curl); cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new AppError("CROSS_ORIGIN", "Cross-origin request blocked", 403);
}

export function errorResponse(e: unknown): Response {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid input", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
      { status: 400 },
    );
  }
  const infra = classifyInfraError(e);
  if (infra) {
    // Safe code for the user/operator; the full detail stays in the server log only.
    console.error(`[infra:${infra}]`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: { code: infra, message: infraMessage(infra) } }, { status: 503 });
  }
  console.error("Unhandled error", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function jsonBody<T>(req: Request, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Request body must be JSON", 400);
  }
  return schema.parse(raw);
}
