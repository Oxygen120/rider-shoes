export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required server configuration: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name)?.trim() || fallback;
}
