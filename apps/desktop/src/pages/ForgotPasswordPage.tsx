import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", background: "radial-gradient(circle at top right, rgba(139,92,246,0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(6,182,212,0.1), transparent 40%)" }}>
      <div style={{ background: "rgba(13,15,26,0.6)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)", padding: "48px 40px", borderRadius: 24, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            🔑
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>Reset Password</h1>
          <div style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 500, textAlign: "center", lineHeight: 1.5 }}>Enter your email address and we'll send you a link to reset your password.</div>
        </div>

        {done ? (
          <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "20px", borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
            <h2 style={{ fontSize: 18, color: "#34D399", margin: "0 0 8px 0", fontWeight: 800 }}>Reset Link Sent</h2>
            <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
              If an account exists for <strong>{email}</strong>, you will receive a password reset email shortly. Please check your inbox and spam folder.
            </div>
            <Link to="/login" style={{ display: "inline-block", marginTop: 24, color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>← Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {err && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, textAlign: "center" }}>{err}</div>}
            
            <div>
              <label htmlFor="e" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Address</label>
              <input
                id="e"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="hello@example.com"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, outline: "none", transition: "all 0.2s" }} 
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
            
            <button type="submit" disabled={loading || !email} 
              style={{ width: "100%", padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2, #8B5CF6) 100%)", color: "#fff", fontSize: 16, fontWeight: 800, border: "none", cursor: loading || !email ? "not-allowed" : "pointer", opacity: loading || !email ? 0.7 : 1, transition: "all 0.2s", boxShadow: "0 8px 24px rgba(139,92,246,0.3)", marginTop: 8 }}>
              {loading ? "Sending link…" : "Send Reset Link →"}
            </button>
          </form>
        )}

        {!done && (
          <div style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>
            Remember your password? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
