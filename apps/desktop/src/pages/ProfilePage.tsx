import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore, Me } from "../lib/auth-store.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";


const BADGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  staff: { bg: "rgba(79,124,255,0.18)", color: "#4F7CFF", label: "⚙️ Staff" },
  "senior-staff": { bg: "rgba(140,94,255,0.18)", color: "#8C5EFF", label: "🛡️ Senior Staff" },
  admin: { bg: "rgba(255,94,173,0.18)", color: "#FF5EAD", label: "👑 Admin" },
  "early-supporter": { bg: "rgba(251,191,36,0.18)", color: "#FBBF24", label: "⭐ Early Supporter" },
  verified: { bg: "rgba(52,211,153,0.18)", color: "#34D399", label: "✓ Verified" },
  developer: { bg: "rgba(6,182,212,0.18)", color: "#06B6D4", label: "💻 Developer of Lensly" },
  owner: { bg: "rgba(245,158,11,0.18)", color: "#F59E0B", label: "👑 Owner of Lensly" },
};

const getRoleWeight = (role?: string | null) => {
  switch (role?.toUpperCase()) {
    case "OWNER": return 100;
    case "CO_OWNER": return 90;
    case "EXECUTIVE_DIRECTOR": return 85;
    case "HEAD_OF_STAFF": return 80;
    case "SENIOR_ADMIN": return 75;
    case "DEVELOPER": return 70;
    case "MANAGER": return 70;
    case "ADMIN": return 65;
    case "HEAD_MODERATOR": return 55;
    case "TRUST_AND_SAFETY": return 50;
    case "HEAD_TRAINER": return 45;
    case "MODERATOR_PLUS": return 42;
    case "MODERATOR": return 40;
    case "TRAINER": return 35;
    case "RECRUITER": return 32;
    case "TRIAL_MODERATOR": return 30;
    case "SUPPORT_AGENT": return 25;
    default: return 0;
  }
};
export function ProfilePage() {
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    statusLine: "",
    avatarUrl: "",
    bannerUrl: "",
    githubUrl: "",
    twitterUrl: "",
    websiteUrl: "",
    isPremium: false
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (me) {
      setForm({ 
        displayName: me.displayName ?? "", 
        bio: me.bio ?? "", 
        statusLine: me.statusLine ?? "",
        avatarUrl: me.avatarUrl ?? "",
        bannerUrl: me.bannerUrl ?? "",
        githubUrl: me.githubUrl ?? "",
        twitterUrl: me.twitterUrl ?? "",
        websiteUrl: me.websiteUrl ?? "",
        isPremium: me.isPremium ?? false
      });
    }
  }, [me]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    if (file.size > 800 * 1024) {
      alert("Image is too large. Please select an image under 800 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        setSaving(true);
        await updateDoc(doc(db, "users", me.id), { avatarUrl: base64 });
        await refreshMe();
      } catch (err) {
        alert("Failed to save avatar: " + err);
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  async function save() {
    if (!me) return;
    if (!form.displayName.trim()) {
      alert("Display name cannot be empty.");
      return;
    }
    setSaving(true);

    const isGif = form.avatarUrl.toLowerCase().includes(".gif") || form.avatarUrl.startsWith("data:image/gif");
    const isCurrentlyPremium = form.isPremium || me.earlySupporter || me.role?.toUpperCase() === "OWNER";
    if (isGif && !isCurrentlyPremium) {
      alert("Animated GIF avatars are a Premium feature! Please enable Premium badge or subscribe first.");
      setSaving(false);
      return;
    }
    
    const payload = {
      displayName: form.displayName,
      bio: form.bio.trim() || null,
      statusLine: form.statusLine.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      bannerUrl: form.bannerUrl.trim() || null,
      githubUrl: form.githubUrl.trim() || null,
      twitterUrl: form.twitterUrl.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      isPremium: form.isPremium
    };

    try {
      await updateDoc(doc(db, "users", me.id), payload);
      await refreshMe(); // Sync auth-store with latest firestore data
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEdit(false);
    } catch (err) {
      alert("Failed to save profile: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!me) return <div className="auth-page" style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading…</div>;

  const initial = (me.displayName ?? me.username)[0].toUpperCase();
  const avatarColors = ["#4F7CFF", "#8C5EFF", "#FF5EAD", "#34D399"];
  const avatarColor = avatarColors[me.username.charCodeAt(0) % avatarColors.length];

  const isHR = getRoleWeight(me.role) >= 60;
  const isBlacklisted = me.staffBlacklisted === true;

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 80 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
        {/* Banner */}
        <div style={{ height: 120, background: me.bannerUrl ? `url(${me.bannerUrl}) center/cover` : "linear-gradient(135deg, #4F7CFF, #8C5EFF, #FF5EAD)", position: "relative" }}>
          <div style={{ position: "absolute", bottom: -40, left: 24 }}>
            <div style={{ position: "relative", width: 80, height: 80 }}>
              {me.avatarUrl
                ? <img src={me.avatarUrl} alt="" style={{ width: 80, height: 80, borderRadius: "50%", border: "5px solid var(--bg-panel)", objectFit: "cover" }} />
                : <div style={{ width: 80, height: 80, borderRadius: "50%", border: "5px solid var(--bg-panel)", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff" }}>{initial}</div>
              }
              <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
              <button onClick={() => avatarRef.current?.click()} style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-panel)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>✏️</button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "52px 24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{me.displayName ?? me.username}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{me.username}</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEdit(!edit)}>
              {edit ? "Cancel" : "✏️ Edit"}
            </button>
          </div>


          {/* Badges — profile page only */}
          {((me.userBadges && me.userBadges.length > 0) || me.earlySupporter || me.verifiedBadge || me.isPremium) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {(me.userBadges as any[] || []).map((b: any) => {
                const s = BADGE_STYLE[b.badge?.slug];
                if (!s) return null;
                return <span key={b.badge.slug} style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{s.label || b.badge.label}</span>;
              })}
              {me.earlySupporter && <span style={{ background: BADGE_STYLE["early-supporter"].bg, color: BADGE_STYLE["early-supporter"].color, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{BADGE_STYLE["early-supporter"].label}</span>}
              {me.verifiedBadge && <span style={{ background: BADGE_STYLE.verified.bg, color: BADGE_STYLE.verified.color, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{BADGE_STYLE.verified.label}</span>}
              {me.isPremium && <span style={{ background: "rgba(140,94,255,0.18)", color: "#8C5EFF", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>💎 Premium Supporter</span>}
            </div>
          )}

          {/* Blacklist indicator — HR only */}
          {isHR && isBlacklisted && (
            <div style={{ marginTop: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🚫</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>STAFF BLACKLISTED</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>This user has been blacklisted from the staff team</div>
              </div>
            </div>
          )}

          {edit ? (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field"><label>Display Name</label><input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} /></div>
              <div className="field"><label>Avatar Image URL</label><input value={form.avatarUrl} onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://example.com/avatar.jpg" /></div>
              <div className="field"><label>Banner Image URL</label><input value={form.bannerUrl} onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))} placeholder="https://example.com/banner.jpg" /></div>
              <div className="field"><label>About Me</label><textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} placeholder="Tell people about yourself…" style={{ resize: "vertical" }} /></div>
              <div className="field"><label>Status</label><input value={form.statusLine} onChange={(e) => setForm((f) => ({ ...f, statusLine: e.target.value }))} placeholder="What are you up to?" /></div>
              <div className="field"><label>GitHub Profile URL</label><input value={form.githubUrl} onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))} placeholder="https://github.com/username" /></div>
              <div className="field"><label>Twitter Profile URL</label><input value={form.twitterUrl} onChange={(e) => setForm((f) => ({ ...f, twitterUrl: e.target.value }))} placeholder="https://twitter.com/username" /></div>
              <div className="field"><label>Website URL</label><input value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://example.com" /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, userSelect: "none", marginTop: 6 }}>
                <input type="checkbox" checked={form.isPremium} onChange={(e) => setForm((f) => ({ ...f, isPremium: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                <span>💎 Enable Lensly Premium Status (Simulated)</span>
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEdit(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              {me.statusLine && <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, display: "flex", gap: 6, alignItems: "center" }}><span>💬</span>{me.statusLine}</div>}
              {me.bio && <div style={{ background: "var(--bg-deep)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{me.bio}</div>}
              {!me.bio && <div style={{ color: "var(--text-dim)", fontSize: 14, fontStyle: "italic" }}>No bio yet. Click Edit to add one.</div>}

              {/* Social Links */}
              {(me.githubUrl || me.twitterUrl || me.websiteUrl) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {me.githubUrl && (
                    <a href={me.githubUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      <span>🐈‍⬛ GitHub</span>
                    </a>
                  )}
                  {me.twitterUrl && (
                    <a href={me.twitterUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      <span>🐦 Twitter</span>
                    </a>
                  )}
                  {me.websiteUrl && (
                    <a href={me.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
                      <span>🌐 Website</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <Link className="btn btn-ghost" to="/app" style={{ fontSize: 13 }}>← Back to Chat</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
