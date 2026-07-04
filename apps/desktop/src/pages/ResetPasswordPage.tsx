import { type FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../lib/firebase.js";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const initial = useMemo(() => params.get("oobCode") ?? params.get("token") ?? "", [params]);
  const [token, setToken] = useState(initial);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await confirmPasswordReset(auth, token, password);
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Failed to update password. The link may be expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", background: "radial-gradient(circle at top right, rgba(139,92,246,0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(6,182,212,0.1), transparent 40%)" }}>
      <div style={{ background: "rgba(13,15,26,0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)", padding: "48px 40px", borderRadius: 24, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            🔐
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>New Password</h1>
          <div style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 500, textAlign: "center", lineHeight: 1.5 }}>Choose a strong password to secure your Lensly account.</div>
        </div>

        {done ? (
          <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "20px", borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, color: "#34D399", margin: "0 0 8px 0", fontWeight: 800 }}>Password Updated</h2>
            <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Your password has been successfully reset. You can now use your new password to sign in.
            </div>
            <Link to="/login" style={{ display: "inline-block", marginTop: 24, padding: "12px 24px", background: "rgba(52,211,153,0.15)", color: "#34D399", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>Go to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: "center" }}>{err}</div>}
            
            {(!initial) && (
              <div>
                <label htmlFor="t" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reset Token</label>
                <input
                  id="t"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="Paste your token here"
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, outline: "none", transition: "all 0.2s" }} 
                  onFocus={e => e.target.style.borderColor = "var(--accent)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
            )}
            
            <div>
              <label htmlFor="p" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>New Password</label>
              <input
                id="p"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, outline: "none", transition: "all 0.2s" }} 
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
            
            <button type="submit" disabled={loading || !token || !password} 
              style={{ width: "100%", padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2, #8B5CF6) 100%)", color: "#fff", fontSize: 16, fontWeight: 800, border: "none", cursor: loading || !token || !password ? "not-allowed" : "pointer", opacity: loading || !token || !password ? 0.7 : 1, transition: "all 0.2s", boxShadow: "0 8px 24px rgba(139,92,246,0.3)", marginTop: 8 }}>
              {loading ? "Updating…" : "Update Password →"}
            </button>
          </form>
        )}

        {!done && (
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>
            Changed your mind? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
