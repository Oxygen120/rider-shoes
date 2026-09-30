import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { User } from "@supabase/supabase-js";
import { clearLegacyPrivateStorage } from "../lib/storage";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

interface SignUpDetails {
  fullName?: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  roles: string[];
  permissions: string[];
  loading: boolean;
  isConfigured: boolean;
  accessVerified: boolean;
  accessError: string | null;
  recoveryMode: boolean;
  hasPermission: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, details?: SignUpDetails) => Promise<{ requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))]
    : [];

const parseAccess = (value: unknown): { roles: string[]; permissions: string[] } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The server returned an invalid access response.");
  }
  const source = value as Record<string, unknown>;
  return { roles: stringArray(source.roles), permissions: stringArray(source.permissions) };
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [accessVerified, setAccessVerified] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const verificationSequence = useRef(0);

  const clearAuthState = useCallback(() => {
    verificationSequence.current += 1;
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setAccessVerified(false);
  }, []);

  const verifyUser = useCallback(async (candidate: User): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured.");
    const sequence = ++verificationSequence.current;
    let lastError: Error | null = null;

    // A browser refresh can race the Supabase token refresh. Retry the access
    // RPC instead of treating a transient network/auth race as a real logout.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (attempt > 0) await wait(180 * Math.pow(2, attempt - 1));
        const { data, error } = await client.rpc("my_access");
        if (error) throw new Error(error.message || "Unable to verify account access.");
        const access = parseAccess(data);
        if (sequence !== verificationSequence.current) return;
        setUser(candidate);
        setRoles(access.roles);
        setPermissions(access.permissions);
        setAccessVerified(true);
        setAccessError(null);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unable to verify account access.");
      }
    }

    throw lastError ?? new Error("Unable to verify account access.");
  }, []);

  const resolveSession = useCallback(async (candidate: User | null): Promise<void> => {
    if (!candidate) {
      clearAuthState();
      setAccessError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Keep the candidate session alive while access verification retries. This
    // is important on refresh: a transient RPC failure must never become a logout.
    setUser(candidate);
    try {
      await verifyUser(candidate);
    } catch (error) {
      setAccessVerified(false);
      setRoles([]);
      setPermissions([]);
      setAccessError(error instanceof Error ? error.message : "Unable to verify account access.");
      // Do NOT sign out here. Supabase owns session persistence; access checks
      // can be retried without destroying a valid browser session.
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, verifyUser]);

  useEffect(() => {
    clearLegacyPrivateStorage();
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        clearAuthState();
        setAccessError(error.message);
        setLoading(false);
        return;
      }
      void resolveSession(data.session?.user ?? null);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      window.setTimeout(() => {
        if (active) void resolveSession(session?.user ?? null);
      }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [clearAuthState, resolveSession]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Account sign-in is unavailable until Supabase is configured.");
    setLoading(true);
    setAccessError(null);
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setLoading(false);
      throw new Error(error?.message || "Sign-in was not accepted.");
    }
    try {
      await verifyUser(data.user);
    } catch (verifyError) {
      // Login failures are still rejected, but we avoid a second sign-out call
      // that can race Supabase's session persistence on slow mobile networks.
      clearAuthState();
      const message = verifyError instanceof Error ? verifyError.message : "Unable to verify account access.";
      setAccessError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, verifyUser]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    details: SignUpDetails = {},
  ): Promise<{ requiresEmailConfirmation: boolean }> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Account creation is unavailable until Supabase is configured.");
    setLoading(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: details.fullName?.trim() || undefined,
            phone: details.phone?.trim() || undefined,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data.user && data.session) await verifyUser(data.user);
      return { requiresEmailConfirmation: !data.session };
    } finally {
      setLoading(false);
    }
  }, [verifyUser]);

  const signOut = useCallback(async (): Promise<void> => {
    const client = getSupabaseClient();
    clearAuthState();
    setRecoveryMode(false);
    clearLegacyPrivateStorage();
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: "global" });
    if (error) throw new Error(error.message || "Unable to complete global sign-out.");
  }, [clearAuthState]);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Password reset is unavailable until Supabase is configured.");
    const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/account`;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Password update is unavailable until Supabase is configured.");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    setRecoveryMode(false);
  }, []);

  const refreshAccess = useCallback(async (): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured.");
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error(error?.message || "No signed-in user.");
    await verifyUser(data.user);
  }, [verifyUser]);

  const hasPermission = useCallback(
    (permission: string) => accessVerified && permissions.includes(permission),
    [accessVerified, permissions],
  );

  const value = useMemo<AuthContextValue>(() => ({
    user,
    roles,
    permissions,
    loading,
    isConfigured: isSupabaseConfigured,
    accessVerified,
    accessError,
    recoveryMode,
    hasPermission,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshAccess,
  }), [
    accessError,
    accessVerified,
    hasPermission,
    loading,
    permissions,
    recoveryMode,
    refreshAccess,
    resetPassword,
    roles,
    signIn,
    signOut,
    signUp,
    updatePassword,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
