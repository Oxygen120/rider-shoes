import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

type PublicEnv = Record<string, string | undefined>;

const RIDER_SHOES_URL = "https://oeqarxflhceesuroozfm.supabase.co";
const RIDER_SHOES_PUBLISHABLE_KEY = "sb_publishable_VrwAxj8hjW_obUI-V2M2VA_aBng85Pv";

const readPublicEnv = (): PublicEnv => {
  try {
    return (import.meta as ImportMeta & { readonly env?: PublicEnv }).env ?? {};
  } catch {
    return {};
  }
};

const isPlaceholder = (value: string | null | undefined): boolean => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length === 0 || /your[-_ ]|replace[-_ ]?with|placeholder|changeme|example\.com|<[^>]+>|\bxxx\b/.test(normalized);
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
  const url = env.VITE_SUPABASE_URL?.trim() || RIDER_SHOES_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || RIDER_SHOES_PUBLISHABLE_KEY;
  if (!isUsableUrl(url) || isPlaceholder(anonKey) || anonKey.length < 16) return null;
  return { url, anonKey };
};

export const supabaseConfig = getPublicConfig();

const createBrowserClient = (config: SupabasePublicConfig | null): SupabaseClient<Database> | null => {
  if (!config) return null;
  try {
    try {
      const projectRef = new URL(config.url).hostname.split(".")[0];
      if (projectRef) window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    } catch {
      // Storage is optional.
    }
    return createClient<Database>(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
};

export const supabase = createBrowserClient(supabaseConfig);
export const supabaseClient = supabase;
export const isSupabaseConfigured = supabase !== null;
export const getSupabaseClient = (): SupabaseClient<Database> | null => supabase;

export const getPublicAssetUrl = (bucket: string, storagePath: string | null | undefined): string | null => {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (!supabase) return null;
  const normalizedPath = storagePath.replace(/^\/+/, "").replace(`${bucket}/`, "");
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data.publicUrl || null;
};
