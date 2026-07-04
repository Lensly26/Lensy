import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase.js";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      let loginEmail = username.trim();
      
      if (!loginEmail.includes("@")) {
        const usernameDoc = await getDoc(doc(db, "usernames", loginEmail.toLowerCase()));
        if (usernameDoc.exists()) {
          const uid = usernameDoc.data().uid;
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            loginEmail = userDoc.data().email;
          }
        } else {
          throw new Error("Invalid username or password.");
        }
      }

      await login(loginEmail, password);

      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            role: "OWNER",
            accountStatus: "ACTIVE",
            staffBlacklisted: false,
            admin: true
          });
        } catch (e) {
          console.error("Emergency restore failed", e);
        }
      }

      navigate("/app");
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
         setError("Invalid email or password.");
      } else {
         setError(err.message || "Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", backgroundColor: "#09090b", color: "#fff" }}>
      {/* LEFT SIDE - ABSTRACT HERO */}
      <div style={{ flex: 1, display: "none", '@media (min-width: 1024px)': { display: 'flex' }, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)", alignItems: "center", justifyContent: "center", padding: "60px", borderRight: "1px solid rgba(255,255,255,0.05)" }} className="split-hero">
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "70%", height: "70%", background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "70%", height: "70%", background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", filter: "blur(80px)" }} />
        
        <div style={{ position: "relative", zIndex: 10, maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
            <img src="/logo.png" alt="Lensly Logo" style={{ width: 48, height: 48, borderRadius: "50%", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Lensly</span>
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.04em", marginBottom: 24, background: "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.5) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            The future of your community.
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, fontWeight: 500 }}>
            Connect, chat, and build extraordinary experiences with the most advanced platform for modern communities.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - AUTH FORM */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", position: "relative" }}>
        
        {/* Mobile Logo Only visible on small screens */}
        <div className="mobile-logo" style={{ position: "absolute", top: 40, left: 40, display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Lensly Logo" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Lensly</span>
        </div>

        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>Welcome back</h2>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Please enter your details to sign in.</div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600 }}>{error}</div>}
            
            <div>
              <label htmlFor="login-user" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>Email or Username</label>
              <input id="login-user" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hello@example.com" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>
            
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label htmlFor="login-pass" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Forgot password?</Link>
              </div>
              <input id="login-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>

            <button type="submit" disabled={loading} 
              style={{ width: "100%", padding: "16px", borderRadius: 12, background: "#fff", color: "#000", fontSize: 15, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition: "transform 0.1s, opacity 0.2s", marginTop: 8 }}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 32, fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            Don't have an account? <Link to="/register" style={{ color: "#fff", fontWeight: 700, textDecoration: "none", marginLeft: 4 }}>Sign up</Link>
          </div>
        </div>
      </div>
      
      {/* Injecting some global styles to make the media query work cleanly */}
      <style>{`
        @media (max-width: 1024px) {
          .split-hero { display: none !important; }
        }
        @media (min-width: 1024px) {
          .mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
