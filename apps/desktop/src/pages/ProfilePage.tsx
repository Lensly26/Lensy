import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";

const BADGE_STYLE: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  staff:           { bg: "rgba(79,124,255,0.12)",  color: "#4F7CFF", border: "rgba(79,124,255,0.3)",  label: "Staff",            icon: "⚙️" },
  "senior-staff":  { bg: "rgba(140,94,255,0.12)",  color: "#8C5EFF", border: "rgba(140,94,255,0.3)",  label: "Senior Staff",     icon: "🛡️" },
  admin:           { bg: "rgba(255,94,173,0.12)",  color: "#FF5EAD", border: "rgba(255,94,173,0.3)",  label: "Admin",            icon: "👑" },
  "early-supporter":{ bg: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "rgba(251,191,36,0.3)",  label: "Early Supporter",  icon: "⭐" },
  verified:        { bg: "rgba(52,211,153,0.12)",  color: "#34D399", border: "rgba(52,211,153,0.3)",  label: "Verified",         icon: "✓" },
  developer:       { bg: "rgba(6,182,212,0.12)",   color: "#06B6D4", border: "rgba(6,182,212,0.3)",   label: "Developer",        icon: "💻" },
  owner:           { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B", border: "rgba(245,158,11,0.3)",  label: "Owner",            icon: "👑" },
};

const getRoleLabel = (role?: string | null) => {
  if (!role) return null;
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};
const getRoleColor = (role?: string | null) => {
  switch (role?.toUpperCase()) {
    case "OWNER": case "CO_OWNER": return "#F59E0B";
    case "DEVELOPER": return "#06B6D4";
    case "ADMIN": case "SENIOR_ADMIN": return "#FF5EAD";
    case "MANAGER": return "#8C5EFF";
    case "MODERATOR_PLUS": case "MODERATOR": return "#4F7CFF";
    case "TRIAL_MODERATOR": return "#60A5FA";
    default: return "var(--text-muted)";
  }
};

export function ProfilePage() {
  const me = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    displayName: "", bio: "", statusLine: "",
    avatarUrl: "", bannerUrl: "",
    githubUrl: "", twitterUrl: "", websiteUrl: "",
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
      });
    }
  }, [me]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    if (file.size > 800 * 1024) { alert("Image is too large. Please select an image under 800 KB."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        setSaving(true);
        await updateDoc(doc(db, "users", me.id), { avatarUrl: base64 });
        await refreshMe();
      } catch (err) { alert("Failed to save avatar: " + err); }
      finally { setSaving(false); }
    };
    reader.readAsDataURL(file);
  };

  async function save() {
    if (!me) return;
    if (!form.displayName.trim()) { alert("Display name cannot be empty."); return; }
    setSaving(true);
    const isGif = form.avatarUrl.toLowerCase().includes(".gif") || form.avatarUrl.startsWith("data:image/gif");
    const isPrem = me.isPremium || me.earlySupporter || me.role?.toUpperCase() === "OWNER";
    if (isGif && !isPrem) { alert("Animated GIF avatars are a Premium feature!"); setSaving(false); return; }
    try {
      await updateDoc(doc(db, "users", me.id), {
        displayName: form.displayName,
        bio: form.bio.trim() || null,
        statusLine: form.statusLine.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        bannerUrl: form.bannerUrl.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        twitterUrl: form.twitterUrl.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
      });
      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEdit(false);
    } catch (err) { alert("Failed to save profile: " + String(err)); }
    finally { setSaving(false); }
  }

  if (!me) return <div className="auth-page" style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading…</div>;

  const initial = (me.displayName ?? me.username)[0].toUpperCase();
  const avatarColors = ["#4F7CFF", "#8C5EFF", "#FF5EAD", "#34D399"];
  const avatarColor = avatarColors[me.username.charCodeAt(0) % avatarColors.length];
  const roleLabel = getRoleLabel(me.role);
  const roleColor = getRoleColor(me.role);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-deep)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "60px 20px 40px",
      fontFamily: "var(--font)"
    }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "30%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,124,255,0.07) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(140,94,255,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        {/* Back link */}
        <Link to="/app" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
          textDecoration: "none", marginBottom: 20,
          transition: "color 0.15s"
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Chat
        </Link>

        {/* Profile Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          overflow: "hidden",
          backdropFilter: "blur(20px)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)"
        }}>

          {/* Banner */}
          <div style={{
            height: 140,
            background: me.bannerUrl
              ? `url(${me.bannerUrl}) center/cover`
              : `linear-gradient(135deg, ${avatarColor}cc 0%, #8C5EFF 50%, #FF5EAD 100%)`,
            position: "relative"
          }}>
            {/* Overlay shimmer */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4) 100%)" }} />

            {/* Edit banner button */}
            {edit && (
              <button onClick={() => {
                const url = prompt("Enter banner image URL:", form.bannerUrl);
                if (url !== null) setForm(f => ({ ...f, bannerUrl: url }));
              }} style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "5px 10px",
                fontSize: 11, fontWeight: 700, color: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Change Banner
              </button>
            )}
          </div>

          {/* Avatar row */}
          <div style={{ padding: "0 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: -44 }}>
            <div style={{ position: "relative" }}>
              {me.avatarUrl
                ? <img src={me.avatarUrl} alt="" style={{ width: 88, height: 88, borderRadius: "50%", border: "4px solid var(--bg-deep)", objectFit: "cover", display: "block" }} />
                : <div style={{ width: 88, height: 88, borderRadius: "50%", border: "4px solid var(--bg-deep)", background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#fff" }}>{initial}</div>
              }
              <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
              <button onClick={() => avatarRef.current?.click()} title="Change avatar" style={{
                position: "absolute", bottom: 4, right: 4,
                width: 26, height: 26, borderRadius: "50%",
                background: "var(--accent)", border: "2px solid var(--bg-deep)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#fff", fontSize: 11
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>

            {/* Edit toggle */}
            <button onClick={() => setEdit(!edit)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 10,
              background: edit ? "rgba(255,255,255,0.06)" : "rgba(79,124,255,0.15)",
              border: `1px solid ${edit ? "rgba(255,255,255,0.1)" : "rgba(79,124,255,0.35)"}`,
              color: edit ? "var(--text-muted)" : "#4F7CFF",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s"
            }}>
              {edit
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Profile</>
              }
            </button>
          </div>

          {/* Info section */}
          <div style={{ padding: "16px 28px 28px" }}>

            {/* Name + handle */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  {me.displayName ?? me.username}
                </span>
                {roleLabel && (
                  <span style={{
                    background: `${roleColor}18`, color: roleColor,
                    border: `1px solid ${roleColor}40`,
                    borderRadius: 6, padding: "2px 8px",
                    fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em"
                  }}>{roleLabel}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>@{me.username}</div>
            </div>

            {/* Status line */}
            {me.statusLine && !edit && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{me.statusLine}</span>
              </div>
            )}

            {/* Badges */}
            {((me.userBadges && me.userBadges.length > 0) || me.earlySupporter || me.verifiedBadge || me.isPremium) && !edit && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {(me.userBadges as any[] || []).map((b: any) => {
                  const s = BADGE_STYLE[b.badge?.slug];
                  if (!s) return null;
                  return (
                    <span key={b.badge.slug} style={{
                      background: s.bg, color: s.color,
                      border: `1px solid ${s.border}`,
                      borderRadius: 8, padding: "4px 10px",
                      fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 4
                    }}>{s.icon} {s.label}</span>
                  );
                })}
                {me.earlySupporter && <span style={{ background: BADGE_STYLE["early-supporter"].bg, color: BADGE_STYLE["early-supporter"].color, border: `1px solid ${BADGE_STYLE["early-supporter"].border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>⭐ Early Supporter</span>}
                {me.verifiedBadge && <span style={{ background: BADGE_STYLE.verified.bg, color: BADGE_STYLE.verified.color, border: `1px solid ${BADGE_STYLE.verified.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>✓ Verified</span>}
                {me.isPremium && <span style={{ background: "rgba(140,94,255,0.12)", color: "#8C5EFF", border: "1px solid rgba(140,94,255,0.3)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>💎 Premium</span>}
              </div>
            )}

            {/* Bio */}
            {!edit && (
              <div style={{
                background: me.bio ? "rgba(255,255,255,0.04)" : "transparent",
                border: me.bio ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderRadius: 12, padding: me.bio ? "12px 16px" : "0",
                fontSize: 13, color: me.bio ? "var(--text-muted)" : "var(--text-dim)",
                lineHeight: 1.7, fontStyle: me.bio ? "normal" : "italic",
                marginBottom: 16
              }}>
                {me.bio || "No bio yet. Click Edit Profile to add one."}
              </div>
            )}

            {/* Social Links */}
            {!edit && (me.githubUrl || me.twitterUrl || me.websiteUrl) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {me.githubUrl && (
                  <a href={me.githubUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 7,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    padding: "6px 12px", borderRadius: 9, fontSize: 12, color: "var(--text-muted)",
                    textDecoration: "none", fontWeight: 600, transition: "all 0.15s"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
                    GitHub
                  </a>
                )}
                {me.twitterUrl && (
                  <a href={me.twitterUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 7,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    padding: "6px 12px", borderRadius: 9, fontSize: 12, color: "var(--text-muted)",
                    textDecoration: "none", fontWeight: 600, transition: "all 0.15s"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#1D9BF0"; e.currentTarget.style.borderColor = "rgba(29,155,240,0.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.737-8.835L1.254 2.25H8.08l4.261 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Twitter / X
                  </a>
                )}
                {me.websiteUrl && (
                  <a href={me.websiteUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: "flex", alignItems: "center", gap: 7,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    padding: "6px 12px", borderRadius: 9, fontSize: 12, color: "var(--text-muted)",
                    textDecoration: "none", fontWeight: 600, transition: "all 0.15s"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Website
                  </a>
                )}
              </div>
            )}

            {/* ── EDIT FORM ── */}
            {edit && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 13 }}>
                {/* Section header */}
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  Edit Profile
                </div>

                {[
                  { label: "Display Name", key: "displayName", placeholder: "Your display name" },
                  { label: "Avatar Image URL", key: "avatarUrl", placeholder: "https://example.com/avatar.jpg" },
                  { label: "Banner Image URL", key: "bannerUrl", placeholder: "https://example.com/banner.jpg" },
                  { label: "Status", key: "statusLine", placeholder: "What are you up to?" },
                  { label: "GitHub URL", key: "githubUrl", placeholder: "https://github.com/username" },
                  { label: "Twitter / X URL", key: "twitterUrl", placeholder: "https://twitter.com/username" },
                  { label: "Website URL", key: "websiteUrl", placeholder: "https://example.com" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>{label}</label>
                    <input
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{
                        width: "100%", padding: "9px 12px",
                        background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 9, color: "#fff", fontSize: 13,
                        outline: "none", transition: "border-color 0.15s", boxSizing: "border-box"
                      }}
                      onFocus={e => e.target.style.borderColor = "rgba(79,124,255,0.5)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                    />
                  </div>
                ))}

                {/* Bio textarea */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>About Me</label>
                  <textarea
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    placeholder="Tell people about yourself…"
                    style={{
                      width: "100%", padding: "9px 12px",
                      background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 9, color: "#fff", fontSize: 13,
                      outline: "none", resize: "vertical", lineHeight: 1.6,
                      transition: "border-color 0.15s", boxSizing: "border-box"
                    }}
                    onFocus={e => e.target.style.borderColor = "rgba(79,124,255,0.5)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                  />
                </div>

                {/* Premium Status */}
                {me.isPremium ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", background: "rgba(140,94,255,0.08)", border: "1px solid rgba(140,94,255,0.2)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>💎</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#8C5EFF" }}>Lensly Premium Active</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>You have access to all premium features</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm("Are you sure you want to cancel your Premium subscription? Your account will be downgraded to the free tier immediately.")) {
                          try {
                            setSaving(true);
                            await updateDoc(doc(db, "users", me.id), {
                              isPremium: false,
                              premiumPlan: null,
                              premiumSince: null,
                              premiumPaymentName: null,
                              premiumPaymentLast4: null
                            });
                            await refreshMe();
                            alert("Subscription cancelled. Your account has been downgraded to the free tier.");
                          } catch (err) {
                            alert("Failed to downgrade: " + err);
                          } finally {
                            setSaving(false);
                          }
                        }
                      }}
                      disabled={saving}
                      style={{
                        width: "100%", padding: "8px", borderRadius: 8,
                        background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; }}
                    >
                      {saving ? "Downgrading..." : "Cancel Subscription (Downgrade)"}
                    </button>
                  </div>
                ) : (
                  <Link to="/premium" style={{ textDecoration: "none", display: "block" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      background: "linear-gradient(135deg, rgba(140,94,255,0.12), rgba(255,94,173,0.08))",
                      border: "1px solid rgba(140,94,255,0.25)", borderRadius: 10,
                      cursor: "pointer", transition: "all 0.15s"
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(140,94,255,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(140,94,255,0.25)"; e.currentTarget.style.transform = "none"; }}
                    >
                      <span style={{ fontSize: 22 }}>💎</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA" }}>Upgrade to Lensly Premium</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Animated avatars, custom banners, badges & more</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                  </Link>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
                  <button onClick={() => setEdit(false)} style={{
                    flex: 1, padding: "10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer"
                  }}>Cancel</button>
                  <button onClick={() => void save()} disabled={saving} style={{
                    flex: 2, padding: "10px", borderRadius: 10,
                    background: saving ? "rgba(79,124,255,0.3)" : "linear-gradient(135deg, #4F7CFF, #8C5EFF)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: saving ? "default" : "pointer",
                    boxShadow: saving ? "none" : "0 4px 16px rgba(79,124,255,0.3)"
                  }}>
                    {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
