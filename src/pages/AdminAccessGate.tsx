import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "../app/AuthContext";
import { Field, Logo } from "../components/Ui";

const ADMIN_UNLOCK_KEY = "rider_shoes_admin_unlocked";

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const { user, accessVerified, loading, hasPermission, signIn, isConfigured } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!user || !accessVerified || !hasPermission("orders.read_all")) {
      setUnlocked(false);
      try { sessionStorage.removeItem(ADMIN_UNLOCK_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      setUnlocked(sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, [user, accessVerified, hasPermission]);

  if (loading && unlocked) return <div className="admin-login"><div className="admin-login-card"><ShieldCheck size={28}/><h1>Verifying access…</h1><p>Checking your secure Rider Shoes admin session.</p></div></div>;

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
      <small className="admin-session-note">This admin unlock is valid only for this browser tab. Closing the tab requires a fresh sign-in.</small>
    </form>
  </div>;
}
