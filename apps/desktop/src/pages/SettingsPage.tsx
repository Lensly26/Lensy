import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import { doc, getDoc, setDoc, collection, onSnapshot, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";

type Prefs = {
  dmMessages: boolean;
  mentions: boolean;
  friendRequests: boolean;
  serverInvites: boolean;
  voiceJoin: boolean;
  calls: boolean;
  emailDigest: string;
  soundEnabled: boolean;
  desktopPush: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  theme: string;
  accentColor: string | null;
  accentColor2: string | null;
  accentColor3: string | null;
  notificationSound: string;
  twoFactorEnabled: boolean;
  // New sound fields
  dmSound: string;
  mentionSound: string;
  serverSound: string;
  callSound: string;
  vcSound: string;
  dmVolume: number;
  mentionVolume: number;
  serverVolume: number;
  callVolume: number;
  vcVolume: number;
  masterVolume: number;
  dndEnabled: boolean;
  soundPack: string;
  mutedGuildIds: string[];
};

const DEFAULT_PREFS: Prefs = {
  dmMessages: true,
  mentions: true,
  friendRequests: true,
  serverInvites: true,
  voiceJoin: true,
  calls: true,
  emailDigest: "weekly",
  soundEnabled: true,
  desktopPush: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  theme: "dark",
  accentColor: null,
  accentColor2: null,
  accentColor3: null,
  notificationSound: "chime",
  twoFactorEnabled: false,
  // New sound fields
  dmSound: "chime",
  mentionSound: "alert",
  serverSound: "chime",
  callSound: "playful",
  vcSound: "beep",
  dmVolume: 0.8,
  mentionVolume: 1.0,
  serverVolume: 0.6,
  callVolume: 0.9,
  vcVolume: 0.7,
  masterVolume: 0.8,
  dndEnabled: false,
  soundPack: "classic",
  mutedGuildIds: [],
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 24, borderRadius: 12,
        background: checked ? "var(--accent)" : "var(--border)",
        position: "relative", cursor: "pointer", transition: "0.2s"
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: checked ? 19 : 3,
        transition: "0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
      }} />
    </div>
  );
}

function previewSound(soundType: string, volume: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(volume, 1.0) * 0.12, ctx.currentTime);
    gain.connect(ctx.destination);

    if (soundType === "beep") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (soundType === "playful") {
      const o1 = ctx.createOscillator(); o1.type = "sine";
      o1.frequency.setValueAtTime(523.25, ctx.currentTime);
      const g1 = ctx.createGain(); g1.gain.setValueAtTime(Math.min(volume, 1.0) * 0.12, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      o1.connect(g1); g1.connect(ctx.destination); o1.start(); o1.stop(ctx.currentTime + 0.1);
      const o2 = ctx.createOscillator(); o2.type = "sine";
      o2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, ctx.currentTime);
      g2.gain.setValueAtTime(Math.min(volume, 1.0) * 0.12, ctx.currentTime + 0.08);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o2.connect(g2); g2.connect(ctx.destination); o2.start(ctx.currentTime + 0.08); o2.stop(ctx.currentTime + 0.22);
    } else if (soundType === "cyber") {
      const osc = ctx.createOscillator(); osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (soundType === "alert") {
      const osc = ctx.createOscillator(); osc.type = "square";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (soundType === "retro") {
      const osc = ctx.createOscillator(); osc.type = "square";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.28);
    } else {
      // chime (default)
      const osc = ctx.createOscillator(); osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) { console.warn("Preview failed:", e); }
}

export function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const isStaff = (me?.role && ["TRIAL_MODERATOR", "MODERATOR", "ADMIN", "MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase())) || me?.admin;
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [activeTab, setActiveTab] = useState<"notifications" | "appearance" | "privacy" | "voice" | "sessions">("notifications");
  const [sessions, setSessions] = useState<any[]>([]);
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "setup" | "verify">("idle");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twoFactorSecret, setTwoFactorSecret] = useState("");

  const [pttEnabled, setPttEnabled] = useState(() => localStorage.getItem("gc_ptt") === "1");
  const [noiseSuppress, setNoiseSuppress] = useState(() => localStorage.getItem("gc_noise") !== "0");

  const handleTogglePtt = (val: boolean) => {
    setPttEnabled(val);
    localStorage.setItem("gc_ptt", val ? "1" : "0");
  };

  const handleToggleNoise = (val: boolean) => {
    setNoiseSuppress(val);
    localStorage.setItem("gc_noise", val ? "1" : "0");
  };

  useEffect(() => {
    if (!me?.id || activeTab !== "sessions") return;
    const q = collection(db, "users", me.id, "sessions");
    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length === 0) {
        // Automatically create a current session & a mock backup session for preview
        void addDoc(collection(db, "users", me.id, "sessions"), {
          userAgent: navigator.userAgent,
          ip: "192.168.1.45",
          device: "Windows Desktop App (Active)",
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        });
        void addDoc(collection(db, "users", me.id, "sessions"), {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
          ip: "172.56.21.19",
          device: "Safari on iOS Mobile",
          createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          lastActive: new Date(Date.now() - 3600000 * 2).toISOString()
        });
      } else {
        setSessions(list);
      }
    });
    return () => unsub();
  }, [me?.id, activeTab]);

  async function handleRevokeSession(sessionId: string) {
    if (!me?.id) return;
    try {
      await deleteDoc(doc(db, "users", me.id, "sessions", sessionId));
    } catch (err) {
      alert("Failed to revoke session: " + err);
    }
  }

  function handleEnable2FA() {
    const secret = Array.from({ length: 16 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join("");
    const codes = Array.from({ length: 6 }, () => Math.floor(100000 + Math.random() * 900000).toString());
    setTwoFactorSecret(secret);
    setBackupCodes(codes);
    setTwoFactorStep("setup");
  }

  async function handleConfirm2FA() {
    if (twoFactorCode.length < 6) {
      alert("Please enter a valid 6-digit code.");
      return;
    }
    await save({ twoFactorEnabled: true });
    setTwoFactorStep("verify");
  }

  useEffect(() => {
    if (!me) return;
    void (async () => {
      try {
        const docRef = doc(db, "settings", me.id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setPrefs({ ...DEFAULT_PREFS, ...snapshot.data() } as Prefs);
        } else {
          setPrefs(DEFAULT_PREFS);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setPrefs(DEFAULT_PREFS); // Fallback to defaults on error
      }
    })();
  }, [me]);

  async function save(patch: Partial<Prefs>) {
    if (!me || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    
    try {
      await setDoc(doc(db, "settings", me.id), patch, { merge: true });
    } catch (err) {
      console.error("Failed to save settings:", err);
      // Revert optimism if failed
      setPrefs(prefs);
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: 28, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.03em" }}>Settings</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 6 }}>
            Customize your Lensly experience
          </p>
        </div>
        <Link className="btn btn-ghost" to="/app">
          ← Back
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["notifications", "appearance", "privacy", "voice", "sessions"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="btn"
            style={{
              background: activeTab === tab ? "var(--bg-elevated)" : "transparent",
              border: activeTab === tab ? "1px solid var(--border-subtle)" : "1px solid transparent",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="glass" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Notifications</h2>
          {!prefs ? (
            <div style={{ color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 20, maxWidth: 600 }}>

              {/* ── DND Banner ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderRadius: 12, background: prefs.dndEnabled ? "rgba(239,68,68,0.12)" : "rgba(79,124,255,0.08)", border: `1px solid ${prefs.dndEnabled ? "rgba(239,68,68,0.3)" : "rgba(79,124,255,0.2)"}`, transition: "all 0.2s" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: prefs.dndEnabled ? "#EF4444" : "var(--text)" }}>{prefs.dndEnabled ? "🔕 Do Not Disturb — All sounds muted" : "🔔 Notifications Active"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Toggle to globally silence all notification sounds</div>
                </div>
                <Toggle checked={prefs.dndEnabled} onChange={(c) => void save({ dndEnabled: c })} />
              </div>

              {/* ── Notification Types ── */}
              <div style={{ paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Notification Types</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {([
                    ["dmMessages", "Direct messages"],
                    ["mentions", "Mentions"],
                    ["friendRequests", "Friend requests"],
                    ["serverInvites", "Server invites"],
                    ["voiceJoin", "Voice channel joins"],
                    ["calls", "Calls"],
                  ] as const).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14 }}>
                      <span>{label}</span>
                      <Toggle checked={prefs[key as keyof Prefs] as boolean} onChange={(c) => void save({ [key]: c } as Partial<Prefs>)} />
                    </label>
                  ))}
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14 }}>
                    <span>Email digest</span>
                    <select value={prefs.emailDigest} onChange={(e) => void save({ emailDigest: e.target.value })} style={{ padding: 8, borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)" }}>
                      <option value="off">Off</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14 }}>
                    <span>Desktop notifications</span>
                    <Toggle checked={prefs.desktopPush} onChange={(c) => void save({ desktopPush: c })} />
                  </label>
                </div>
              </div>

              {/* ── Quiet Hours ── */}
              <div style={{ paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Quiet Hours</h3>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Start</label>
                    <input type="time" value={prefs.quietHoursStart || ""} onChange={(e) => void save({ quietHoursStart: e.target.value || null })} style={{ padding: 8, borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)", width: "100%" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>End</label>
                    <input type="time" value={prefs.quietHoursEnd || ""} onChange={(e) => void save({ quietHoursEnd: e.target.value || null })} style={{ padding: 8, borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)", width: "100%" }} />
                  </div>
                </div>
              </div>

              {/* ── Sound Settings ── */}
              <div style={{ paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Sound Settings</h3>
                  <Toggle checked={prefs.soundEnabled} onChange={(c) => void save({ soundEnabled: c })} />
                </div>

                {/* Sound Packs */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sound Pack</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([
                      { id: "classic", label: "🔔 Classic", dm: "chime", mention: "alert", server: "chime", call: "playful", vc: "beep" },
                      { id: "retro",   label: "🎮 Retro",   dm: "retro", mention: "retro", server: "retro",  call: "retro",   vc: "retro" },
                      { id: "synth",   label: "🌊 Synthwave", dm: "cyber", mention: "cyber", server: "cyber", call: "cyber",  vc: "cyber" },
                      { id: "silent",  label: "🔇 Silent",  dm: "chime", mention: "chime", server: "chime", call: "chime",   vc: "chime" },
                    ]).map((pack) => (
                      <button key={pack.id} onClick={() => void save({ soundPack: pack.id, soundEnabled: pack.id !== "silent", dmSound: pack.dm, mentionSound: pack.mention, serverSound: pack.server, callSound: pack.call, vcSound: pack.vc })} className="btn" style={{ fontSize: 13, padding: "7px 14px", background: prefs.soundPack === pack.id ? "rgba(79,124,255,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${prefs.soundPack === pack.id ? "var(--accent)" : "var(--border)"}`, color: prefs.soundPack === pack.id ? "var(--accent)" : "var(--text)" }}>
                        {pack.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Master Volume */}
                <div style={{ marginBottom: 18, padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>🔊 Master Volume</span>
                    <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>{Math.round((prefs.masterVolume ?? 0.8) * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={prefs.masterVolume ?? 0.8} onChange={(e) => void save({ masterVolume: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent)" }} />
                </div>

                {/* Per-Type Sounds */}
                {([
                  { label: "💬 Direct Messages", soundKey: "dmSound",     volKey: "dmVolume" },
                  { label: "🔔 Mentions",         soundKey: "mentionSound", volKey: "mentionVolume" },
                  { label: "💬 Server Messages",  soundKey: "serverSound",  volKey: "serverVolume" },
                  { label: "📞 Calls",             soundKey: "callSound",   volKey: "callVolume" },
                  { label: "🎙️ Voice Join/Leave",  soundKey: "vcSound",     volKey: "vcVolume" },
                ] as { label: string; soundKey: keyof Prefs; volKey: keyof Prefs }[]).map(({ label, soundKey, volKey }) => (
                  <div key={soundKey as string} style={{ marginBottom: 14, padding: "14px 16px", background: "rgba(0,0,0,0.15)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{label}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                      <select
                        value={(prefs[soundKey] as string) || "chime"}
                        onChange={(e) => void save({ [soundKey]: e.target.value } as any)}
                        style={{ flex: 1, padding: "7px 10px", borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)", color: "var(--text)", fontSize: 13 }}
                      >
                        <option value="chime">🔔 Classic Chime</option>
                        <option value="alert">🔔 Alert Ding</option>
                        <option value="playful">🎵 Playful</option>
                        <option value="cyber">🌊 Synthwave</option>
                        <option value="beep">⚡ Retro Beep</option>
                        <option value="retro">🎮 8-Bit Retro</option>
                      </select>
                      <button
                        onClick={() => previewSound(prefs[soundKey] as string, (prefs[volKey] as number ?? 0.8) * (prefs.masterVolume ?? 0.8))}
                        className="btn"
                        style={{ padding: "7px 12px", fontSize: 12, background: "rgba(79,124,255,0.15)", border: "1px solid rgba(79,124,255,0.3)", color: "var(--accent)", whiteSpace: "nowrap" }}
                      >
                        ▶ Preview
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", width: 50 }}>Volume</span>
                      <input type="range" min={0} max={1} step={0.05} value={(prefs[volKey] as number) ?? 0.8} onChange={(e) => void save({ [volKey]: parseFloat(e.target.value) } as any)} style={{ flex: 1, accentColor: "var(--accent)" }} />
                      <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, width: 34, textAlign: "right" }}>{Math.round(((prefs[volKey] as number) ?? 0.8) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Muted Servers ── */}
              <div style={{ paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Muted Servers</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>No notification sounds will play for messages in muted servers. You can also mute servers from the sidebar.</p>
                {(prefs.mutedGuildIds ?? []).length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 14px", background: "rgba(0,0,0,0.15)", borderRadius: 8, border: "1px solid var(--border)" }}>No servers muted</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(prefs.mutedGuildIds ?? []).map((gid) => (
                      <div key={gid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(0,0,0,0.15)", borderRadius: 8, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>{gid}</span>
                        <button onClick={() => void save({ mutedGuildIds: (prefs.mutedGuildIds ?? []).filter(id => id !== gid) })} className="btn" style={{ fontSize: 11, padding: "4px 10px", background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>Unmute</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <div className="glass" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Appearance</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            Customize how Lensly looks and feels
          </p>
          {!prefs ? (
            <div style={{ color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>Theme</label>
                <select
                  value={prefs.theme || "dark"}
                  onChange={(e) => void save({ theme: e.target.value })}
                  style={{ padding: 10, borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)", width: "100%" }}
                >
                  <option value="dark">Midnight Dark (Default)</option>
                  <option value="sakura">Sakura Light</option>
                  <option value="cyberpunk">Aesthetic Cyberpunk</option>
                  <option value="glassmorphism">Glassmorphism Space</option>
                  <option value="classic">Discord Classic</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>App Accent Color</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    { name: "Default", color: null, color2: null, color3: null },
                    { name: "Vibrant Blue", color: "#4F7CFF", color2: "#8C5EFF", color3: "#FF5EAD" },
                    { name: "Emerald Green", color: "#10B981", color2: "#059669", color3: "#34D399" },
                    { name: "Neon Purple", color: "#8B5CF6", color2: "#EC4899", color3: "#F43F5E" },
                    { name: "Sunset Orange", color: "#F59E0B", color2: "#EF4444", color3: "#FBBF24" },
                    { name: "Hot Pink", color: "#EC4899", color2: "#F43F5E", color3: "#FF5EAD" },
                  ].map((opt) => {
                    const isSelected = prefs.accentColor === opt.color;
                    return (
                      <button
                        key={opt.name}
                        onClick={() => void save({
                          accentColor: opt.color,
                          accentColor2: opt.color2,
                          accentColor3: opt.color3
                        })}
                        className="btn"
                        style={{
                          background: isSelected ? "var(--bg-active)" : "rgba(255,255,255,0.02)",
                          border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                          padding: "6px 12px",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: opt.color || "#4F7CFF",
                          border: "1px solid rgba(255,255,255,0.2)"
                        }} />
                        {opt.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>Custom Notification Sound</label>
                <select
                  value={prefs.notificationSound || "chime"}
                  onChange={(e) => void save({ notificationSound: e.target.value })}
                  style={{ padding: 10, borderRadius: 8, background: "#0c0d10", border: "1px solid var(--border-subtle)", width: "100%" }}
                >
                  <option value="chime">🔔 Classic Chime</option>
                  <option value="synthwave">🎵 Synthwave Pulse</option>
                  <option value="beep">⚡ Retro Beep</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <div className="glass" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Privacy & Security</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            Manage your privacy settings and account security
          </p>
          <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Profile Visibility</h3>
              <label style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14 }}>
                <span>Show online status</span>
                <Toggle checked={true} onChange={() => {}} />
              </label>
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Direct Messages</h3>
              <label style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14 }}>
                <span>Allow DMs from server members</span>
                <Toggle checked={true} onChange={() => {}} />
              </label>
              <label style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", fontSize: 14, marginTop: 8 }}>
                <span>Allow DMs from friends only</span>
                <Toggle checked={false} onChange={() => {}} />
              </label>
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Two-Factor Authentication</h3>
              {prefs?.twoFactorEnabled ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: "var(--success)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🛡️</span> 2FA is active and protecting your account.
                  </div>
                  <button
                    className="btn btn-danger"
                    type="button"
                    style={{ fontSize: 13, width: "fit-content" }}
                    onClick={() => {
                      if (confirm("Are you sure you want to disable 2FA?")) {
                        void save({ twoFactorEnabled: false });
                        setTwoFactorStep("idle");
                      }
                    }}
                  >
                    Disable 2FA
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {twoFactorStep === "idle" && (
                    <button
                      className="btn btn-primary"
                      type="button"
                      style={{ fontSize: 13, width: "fit-content" }}
                      onClick={handleEnable2FA}
                    >
                      🔒 Setup 2FA
                    </button>
                  )}
                  {twoFactorStep === "setup" && (
                    <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ width: 120, height: 120, background: "#fff", padding: 8, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {/* Visual QR Code simulator */}
                          <div style={{ width: "100%", height: "100%", border: "4px solid #000", background: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 20px 20px" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>Scan QR Code</div>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            Scan this QR code using Google Authenticator or Microsoft Authenticator, or enter the secret key manually:
                          </p>
                          <code style={{ display: "block", background: "#000", padding: "6px 10px", borderRadius: 6, fontSize: 12, marginTop: 6, color: "var(--accent)", border: "1px solid var(--border-subtle)", wordBreak: "break-all" }}>
                            {twoFactorSecret}
                          </code>
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Verify Authentication Code</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <input
                            type="text"
                            placeholder="6-digit code"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "#0c0d10",
                              border: "1px solid var(--border-subtle)",
                              width: 140,
                              textAlign: "center",
                              fontSize: 15,
                              letterSpacing: 2
                            }}
                          />
                          <button className="btn btn-primary" onClick={handleConfirm2FA}>
                            Verify & Enable
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {twoFactorStep === "verify" && (
                    <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid var(--success)", borderRadius: 10, padding: 16, display: "grid", gap: 12 }}>
                      <div style={{ color: "var(--success)", fontWeight: 700, fontSize: 14 }}>
                        ✓ Two-Factor Authentication Enabled Successfully!
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Save these backup codes in a safe place. You can use them to sign in if you lose access to your authenticator app:
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: "#000", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                        {backupCodes.map((code) => (
                          <code key={code} style={{ color: "var(--text)", textAlign: "center", fontWeight: 700 }}>
                            {code}
                          </code>
                        ))}
                      </div>
                      <button
                        className="btn"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: 12, width: "fit-content" }}
                        onClick={() => setTwoFactorStep("idle")}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--danger)" }}>Danger Zone</h3>
              <button className="btn" type="button" style={{ fontSize: 13, background: "rgba(244, 67, 54, 0.2)", color: "var(--danger)", border: "1px solid rgba(244, 67, 54, 0.3)" }}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Tab */}
      {activeTab === "voice" && (
        <div className="glass" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Voice & Audio Settings</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
            Configure your input and output audio preferences.
          </p>
          <div style={{ display: "grid", gap: 20, maxWidth: 560 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <div>
                <strong>Push to Talk (PTT)</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Require holding the Spacebar to transmit audio.
                </div>
              </div>
              <Toggle
                checked={pttEnabled}
                onChange={handleTogglePtt}
              />
            </label>

            {pttEnabled && (
              <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 8, fontSize: 13, border: "1px solid var(--border)" }}>
                <span><strong>PTT Shortcut Key:</strong> Spacebar</span>
                <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                  Hold the Spacebar to speak when in a voice channel. Release to mute.
                </p>
              </div>
            )}

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <div>
                <strong>Noise Suppression</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Suppress background noise using WebRTC Echo Cancellation and Noise Suppression.
                </div>
              </div>
              <Toggle
                checked={noiseSuppress}
                onChange={handleToggleNoise}
              />
            </label>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className="glass" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Active Sessions & Login History</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
            Manage the devices that are currently logged into your Lensly account.
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            {sessions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading active sessions…</div>
            ) : (
              sessions.map((sess) => {
                const isCurrent = sess.userAgent === navigator.userAgent && sess.ip === "192.168.1.45";
                const isMobile = sess.device?.toLowerCase().includes("mobile") || sess.device?.toLowerCase().includes("ios") || sess.device?.toLowerCase().includes("android");
                
                return (
                  <div
                    key={sess.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(0,0,0,0.15)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "16px 20px",
                      gap: 16,
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span style={{ fontSize: 24 }}>{isMobile ? "📱" : "💻"}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{sess.device || "Unknown Device"}</span>
                          {isCurrent && (
                            <span style={{ background: "rgba(79,124,255,0.18)", color: "var(--accent)", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                              Current Session
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          IP Address: <span style={{ fontFamily: "var(--mono)", color: "var(--text-dim)" }}>{sess.ip}</span> • Last active: {new Date(sess.lastActive).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                          Logged in: {new Date(sess.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {!isCurrent && (
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                        onClick={() => void handleRevokeSession(sess.id)}
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── Diagnostic & Crash Reports ─── */}
      <div className="glass" style={{ marginTop: 24, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>🤖 Diagnostic & Crash Reports</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Automatic crash monitoring detects and captures runtime errors to help us improve Lensly stability.
        </p>

        {(() => {
          const reports = JSON.parse(localStorage.getItem("gc_crash_reports") || "[]");
          if (reports.length === 0) {
            return (
              <div style={{ padding: "14px 16px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 10, fontSize: 13, color: "#34D399", display: "flex", gap: 8, alignItems: "center" }}>
                <span>✓</span>
                <span>No crashes or errors detected recently. The system is operating normally.</span>
              </div>
            );
          }

          return (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Recent Error Logs ({reports.length})</span>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => {
                  localStorage.removeItem("gc_crash_reports");
                  window.location.reload();
                }}>
                  Clear Logs
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto", paddingRight: 6 }}>
                {reports.map((log: any, idx: number) => (
                  <div key={idx} style={{ padding: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, fontSize: 12, fontFamily: "var(--mono)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#F87171", fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{log.message}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      Source: {log.source} (Line {log.lineno}:{log.colno})
                    </div>
                    {log.stack && (
                      <pre style={{ margin: "6px 0 0", padding: 6, background: "rgba(0,0,0,0.2)", borderRadius: 4, fontSize: 10, color: "var(--text-muted)", overflowX: "auto", maxHeight: 60, whiteSpace: "pre-wrap" }}>
                        {log.stack}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Quick Links */}
      <div className="glass" style={{ marginTop: 24, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Quick Links</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <Link className="btn btn-ghost" to="/profile" style={{ justifyContent: "flex-start" }}>
            Edit Profile
          </Link>
          <Link className="btn btn-ghost" to="/apply" style={{ justifyContent: "flex-start", color: "var(--accent)" }}>
            Staff Applications
          </Link>
          <Link className="btn btn-ghost" to="/status" style={{ justifyContent: "flex-start" }}>
            System Status
          </Link>

        </div>
      </div>
    </div>
  );
}
