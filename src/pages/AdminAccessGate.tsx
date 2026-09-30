import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { Field, Logo } from "../components/Ui";

const ADMIN_UNLOCK_KEY = "rider_shoes_admin_unlocked";

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const { user, accessVerified, accessError, loading, hasPermission, signIn, refreshAccess, isConfigured } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1"; } catch { return false; }
  });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!user) {
      setUnlocked(false);
      try { sessionStorage.removeItem(ADMIN_UNLOCK_KEY); } catch { /* ignore */ }
      return;
    }
    if (accessVerified && hasPermission("orders.read_all")) {
      try { sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1"); } catch { /* ignore */ }
      setUnlocked(true);
    }
  }, [user, accessVerified, hasPermission]);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshAccess();
      try { sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1"); } catch { /* ignore */ }
      setUnlocked(true);
    } catch {
      // AuthContext deliberately keeps the Supabase session alive.
    } finally {
      setRetrying(false);
    }
  };

  if (loading && (unlocked || user)) return <div className="admin-login"><div className="admin-login-card"><ShieldCheck size={28}/><h1>Verifying access…</h1><p>Checking your secure Rider Shoes admin session. Your login will remain active during refresh.</p></div></div>;

  if (user && !accessVerified && accessError) {
    return <div className="admin-login"><div className="admin-login-card">
      <Logo light/>
      <div className="admin-secure-badge"><ShieldCheck size={14}/> SESSION RESTORED · ACCESS CHECK</div>
      <h1>One more security check</h1>
      <p>Your Supabase session is still present, but the admin permission check needs another attempt. You are not being logged out.</p>
      <div className="error-text" style={{marginTop:14}}>{accessError}</div>
      <button className="button button-primary button-block" style={{marginTop:16}} onClick={()=>void retry()} disabled={retrying}>
        <RefreshCw size={14}/> {retrying ? "Checking…" : "Retry security check"}
      </button>
    </div></div>;
  }

  if (user && accessVerified && !hasPermission("orders.read_all")) {
    return <div className="admin-login"><div className="admin-login-card">
      <Logo light/><div className="admin-secure-badge"><ShieldCheck size={14}/> ACCESS RESTRICTED</div>
      <h1>Admin access required</h1><p>This account is signed in, but it does not have the required admin permission.</p>
    </div></div>;
  }

  if (!unlocked || !user || !accessVerified || !hasPermission("orders.read_all")) {
    return <AdminSignIn onSuccess={() => setUnlocked(true)} signIn={signIn} isConfigured={isConfigured}/>;
  }

  return <>{children}</>;
}

function AdminSignIn({ onSuccess, signIn, isConfigured }: {
  onSuccess: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  isConfigured: boolean;
}) {
  const [email, setEmail] = useState("oyy.rafiq@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (!isConfigured) throw new Error("Supabase is not configured.");
      await signIn(email, password);
      try { sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1"); } catch { /* ignore */ }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  return <div className="admin-login">
    <form className="admin-login-card" onSubmit={submit}>
      <Logo light/>
      <div className="admin-secure-badge"><ShieldCheck size={14}/> SECURE ADMIN ACCESS</div>
      <h1>Rider Shoes Admin</h1>
      <p>Sign in to manage products, orders, visits, delivery and business settings.</p>
      <Field label="Admin email" name="admin-gate-email" type="email" value={email} onChange={setEmail} required/>
      <Field label="Password" name="admin-gate-password" type="password" value={password} onChange={setPassword} required/>
      {error && <div className="error-text">{error}</div>}
      <button className="button button-primary button-block" style={{ marginTop: 16 }}>Sign in <ExternalLink size={14}/></button>
      <small className="admin-session-note">Your secure Supabase session persists through browser refresh. Closing this tab requires a fresh admin sign-in.</small>
    </form>
  </div>;
}
