import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Rider Shoes client runtime error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || "Unknown client-side error";
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f7f6", color: "#182326", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "min(680px, 100%)", padding: 24, borderRadius: 18, background: "#fff", border: "1px solid #dbe4e1", boxShadow: "0 14px 40px rgba(20,35,38,.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#ef6b4f" }}>Rider Shoes · Runtime error</div>
          <h1 style={{ margin: "10px 0 8px", fontSize: 24 }}>The page could not render.</h1>
          <p style={{ margin: 0, lineHeight: 1.55, wordBreak: "break-word" }}>{message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 18, border: 0, borderRadius: 10, padding: "11px 16px", background: "#ef6b4f", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reload page</button>
        </div>
      </div>
    );
  }
}
