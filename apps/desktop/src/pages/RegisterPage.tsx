import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";

function isUsernameOffensive(username: string): boolean {
  let cleaned = username.toLowerCase().trim();
  const leetMap: Record<string, string> = {
    '1': 'i', 'l': 'i', '!': 'i', '|': 'i',
    '0': 'o',
    '3': 'e',
    '4': 'a', '@': 'a',
    '5': 's', '$': 's',
    '7': 't',
    '8': 'b',
    '9': 'g',
    'v': 'u', 'w': 'uu'
  };
  
  let normalized = "";
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    normalized += leetMap[char] || char;
  }

  const blacklist = [
    "nigger", "nigga", "kike", "faggot", "fag", "dyke", "retard", "spic", "chink", "cunt",
    "bitch", "whore", "slut", "rape", "pedophile", "pedophiliac", "bastard",
    "motherfucker", "fucker", "fuck", "asshole", "cocksucker", "dickhead"
  ];

  for (const word of blacklist) {
    if (cleaned.includes(word) || normalized.includes(word)) {
      return true;
    }
  }
  return false;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    if (isUsernameOffensive(form.username)) {
      setError("Username contains blocked or offensive language.");
      setLoading(false);
      return;
    }

    try {
      const usernameDocRef = doc(db, "usernames", form.username.toLowerCase());
      const usernameDoc = await getDoc(usernameDocRef);
      if (usernameDoc.exists()) {
        throw new Error("Username already taken.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;

      if (form.displayName) {
        await updateProfile(user, { displayName: form.displayName });
      }

      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        username: form.username.toLowerCase(),
        email: form.email,
        emailVerified: user.emailVerified,
        displayName: form.displayName || form.username,
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        statusLine: null,
        presenceStatus: "ONLINE",
        accountStatus: "ACTIVE",
        earlySupporter: false,
        verifiedBadge: false,
        userBadges: [],
        admin: false,
      });

      await setDoc(usernameDocRef, { uid: user.uid });

      navigate("/app");
    } catch (err: any) {
      setError(err.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", backgroundColor: "#09090b", color: "#fff" }}>
      {/* LEFT SIDE - ABSTRACT HERO */}
      <div style={{ flex: 1, display: "none", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #09090b 0%, #18181b 100%)", alignItems: "center", justifyContent: "center", padding: "60px", borderRight: "1px solid rgba(255,255,255,0.05)" }} className="split-hero">
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", position: "relative", overflowY: "auto" }}>
        
        {/* Mobile Logo Only visible on small screens */}
        <div className="mobile-logo" style={{ position: "absolute", top: 40, left: 40, display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Lensly Logo" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Lensly</span>
        </div>

        <div style={{ width: "100%", maxWidth: 400, marginTop: "auto", marginBottom: "auto", paddingTop: 80, paddingBottom: 40 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>Create an account</h2>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Join Lensly and start building your community.</div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600 }}>{error}</div>}
            
            <div>
              <label htmlFor="reg-username" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>Username</label>
              <input id="reg-username" required autoFocus value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="cooluser123" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>

            <div>
              <label htmlFor="reg-display" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>Display Name <span style={{ opacity: 0.5, fontWeight: 400 }}>(Optional)</span></label>
              <input id="reg-display" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Your Name" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>
            
            <div>
              <label htmlFor="reg-email" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>Email Address</label>
              <input id="reg-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>

            <div>
              <label htmlFor="reg-pass" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>Password</label>
              <input id="reg-pass" type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 6 characters" 
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, outline: "none", transition: "all 0.2s", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} 
                onFocus={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "rgba(255,255,255,0.05)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.03)"; }}
              />
            </div>

            <button type="submit" disabled={loading} 
              style={{ width: "100%", padding: "16px", borderRadius: 12, background: "#fff", color: "#000", fontSize: 15, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, transition: "transform 0.1s, opacity 0.2s", marginTop: 8 }}>
              {loading ? "Creating…" : "Create Account"}
            </button>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: 0, fontWeight: 500 }}>
              By registering, you agree to our Terms of Service.
            </p>
          </form>

          <div style={{ marginTop: 32, fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            Already have an account? <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "none", marginLeft: 4 }}>Sign in</Link>
          </div>
        </div>
      </div>
      
      <style>{`
        @media (max-width: 1024px) {
          .split-hero { display: none !important; }
        }
        @media (min-width: 1024px) {
          .mobile-logo { display: none !important; }
          .split-hero { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
