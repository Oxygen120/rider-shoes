import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

type PublicEnv = Record<string, string | undefined>;

const readPublicEnv = (): PublicEnv => {
  try {
    return (
      (import.meta as ImportMeta & { readonly env?: PublicEnv }).env ?? {}
    );
  } catch {
    // `import.meta.env` is not available in a few non-Vite test runners.
    return {};
  }
};

const isPlaceholder = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    /your[-_ ]|replace[-_ ]?with|placeholder|changeme|example\.com|<[^>]+>|\bxxx\b/.test(
      normalized,
    )
  );
};

const isUsableUrl = (value: string): boolean => {
  if (isPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const getPublicConfig = (): SupabasePublicConfig | null => {
  const env = readPublicEnv();
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

  // Only VITE_* values are read here. Service-role and other server secrets
  // must never be bundled into browser code.
  if (!isUsableUrl(url) || isPlaceholder(anonKey) || anonKey.length < 16) {
    return null;
  }
  return { url, anonKey };
};

export const supabaseConfig = getPublicConfig();

const createBrowserClient = (
  config: SupabasePublicConfig | null,
): SupabaseClient<Database> | null => {
  if (!config) return null;
  try {
    // Older builds used Supabase's default localStorage session persistence.
    // This storefront intentionally keeps access/refresh tokens in memory.
    try {
      const projectRef = new URL(config.url).hostname.split(".")[0];
      if (projectRef) window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    } catch {
      // Storage can be unavailable in private/sandboxed contexts.
    }
    return createClient<Database>(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    // Invalid or partially configured public settings should behave exactly
    // like an unconfigured local/demo environment.
    return null;
  }
};

export const supabase = createBrowserClient(supabaseConfig);
export const supabaseClient = supabase;
export const isSupabaseConfigured = supabase !== null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => supabase;

export const getPublicAssetUrl = (
  bucket: string,
  storagePath: string | null | undefined,
): string | null => {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (!supabase) return null;

  const normalizedPath = storagePath.replace(/^\/+/, "").replace(`${bucket}/`, "");
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data.publicUrl || null;
};
