const configuredOrigin = Deno.env.get('APP_ORIGIN')?.trim();

export const corsHeaders = {
  'Access-Control-Allow-Origin': configuredOrigin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders },
  });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error('Request body must be valid JSON');
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function errorResponse(_error: unknown, fallback = 'Internal server error'): Response {
  // Do not serialize provider responses or unknown errors: they may contain
  // tokens, card metadata, or other information that must stay server-side.
  return json({ error: fallback }, 500);
}
