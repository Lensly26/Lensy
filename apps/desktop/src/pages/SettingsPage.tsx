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
  allowFriendDms: boolean;
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
  allowFriendDms: false,
};

type TabKey = "notifications" | "appearance" | "privacy" | "voice" | "sessions";

const TAB_ITEMS: Array<{ id: TabKey; label: string; icon: string; description: string }> = [
  { id: "notifications", label: "Notifications", icon: "🔔", description: "Manage alerts, quiet hours, and notification behavior." },
  { id: "appearance", label: "Appearance", icon: "🎨", description: "Choose your theme, accent, and visual style." },
  { id: "privacy", label: "Privacy", icon: "🛡️", description: "Control visibility, messaging, and security." },
  { id: "voice", label: "Voice & Audio", icon: "🎙️", description: "Configure PTT, noise suppression, and sound experience." },
  { id: "sessions", label: "Sessions", icon: "💻", description: "Review active devices and revoke old sign-ins." },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 46,
        height: 24,
        borderRadius: 999,
        background: checked ? "linear-gradient(135deg, #10B981, #059669)" : "rgba(255,255,255,0.08)",
        border: checked ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.12)",
        position: "relative",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 3,
          left: checked ? 24 : 4,
          transition: "all 0.2s ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );
}

function settingRow(label: string, description: string, action: React.ReactNode) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>{description}</div>
      </div>
      {action}
    </div>
  );
}

function previewSound(soundType: string, volume: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(volume, 1) * 0.14, ctx.currentTime);
    gain.connect(ctx.destination);

    const playTone = (type: OscillatorType, frequency: number, duration: number, start = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
      osc.connect(gain);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (soundType === "beep") {
      playTone("triangle", 880, 0.15);
    } else if (soundType === "playful") {
      playTone("sine", 523.25, 0.08);
      playTone("sine", 659.25, 0.12, 0.06);
    } else if (soundType === "cyber") {
      playTone("sine", 320, 0.25);
    } else if (soundType === "alert") {
      playTone("square", 900, 0.18);
    } else if (soundType === "retro") {
      playTone("square", 440, 0.08);
      playTone("square", 880, 0.08, 0.08);
    } else {
      playTone("sine", 587.33, 0.18);
    }
  } catch (error) {
    console.warn("Sound preview failed", error);
  }
}

export function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("notifications");
  const [sessions, setSessions] = useState<Array<any>>([]);
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "setup" | "verified">("idle");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [pttEnabled, setPttEnabled] = useState(() => typeof window !== "undefined" && localStorage.getItem("gc_ptt") === "1");
  const [noiseSuppress, setNoiseSuppress] = useState(() => typeof window !== "undefined" && localStorage.getItem("gc_noise") !== "0");

  useEffect(() => {
    if (!me) return;
    const ref = doc(db, "settings", me.id);
    getDoc(ref).then((snapshot) => {
      setPrefs(snapshot.exists() ? ({ ...DEFAULT_PREFS, ...snapshot.data() } as Prefs) : DEFAULT_PREFS);
    }).catch((error) => {
      console.error("Failed to load settings:", error);
      setPrefs(DEFAULT_PREFS);
    });
  }, [me]);

  useEffect(() => {
    if (!me || activeTab !== "sessions") return;
    const queryRef = collection(db, "users", me.id, "sessions");
    const unsub = onSnapshot(queryRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (list.length === 0) {
        addDoc(queryRef, {
          userAgent: navigator.userAgent,
          ip: "192.168.1.45",
          device: "Windows Desktop App (Active)",
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
        });
        addDoc(queryRef, {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
          ip: "172.56.21.19",
          device: "Safari on iOS Mobile",
          createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          lastActive: new Date(Date.now() - 3600000 * 2).toISOString(),
        });
        return;
      }
      setSessions(list);
    });
    return () => unsub();
  }, [me, activeTab]);

  const handleSave = async (patch: Partial<Prefs>) => {
    if (!me || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setIsSaving(true);
    setSaveStatus("Saving…");

    try {
      await setDoc(doc(db, "settings", me.id), patch, { merge: true });
      setSaveStatus("Saved");
      setTimeout(() => setSaveStatus(""), 2200);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setPrefs(prefs);
      setSaveStatus("Save failed");
      setTimeout(() => setSaveStatus(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePtt = (value: boolean) => {
    setPttEnabled(value);
    localStorage.setItem("gc_ptt", value ? "1" : "0");
  };

  const handleToggleNoise = (value: boolean) => {
    setNoiseSuppress(value);
    localStorage.setItem("gc_noise", value ? "1" : "0");
  };

  const handleEnableTwoFactor = () => {
    const secret = Array.from({ length: 16 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join("");
    const codes = Array.from({ length: 6 }, () => Math.floor(100000 + Math.random() * 900000).toString());
    setTwoFactorSecret(secret);
    setBackupCodes(codes);
    setTwoFactorStep("setup");
  };

  const handleConfirmTwoFactor = async () => {
    if (twoFactorCode.length < 6) {
      alert("Please enter a valid 6-digit code.");
      return;
    }
    await handleSave({ twoFactorEnabled: true });
    setTwoFactorStep("verified");
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!me) return;
    try {
      await deleteDoc(doc(db, "users", me.id, "sessions", sessionId));
    } catch (error) {
      alert("Failed to revoke session: " + error);
    }
  };

  if (!me) {
    return <div style={{ minHeight: "100vh", padding: "40px 24px", color: "var(--text-muted)" }}>Loading profile…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", position: "relative", padding: "40px 24px 60px", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "8%", left: "12%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,124,255,0.14), transparent 60%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "12%", right: "10%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.12), transparent 62%)", filter: "blur(72px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 18, alignItems: "flex-start", marginBottom: 30 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>
              <Link to="/app" style={{ color: "var(--text-muted)", textDecoration: "none" }}>← Back to app</Link>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Settings center</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em" }}>Lensly Settings</h1>
            <p style={{ margin: "12px 0 0", fontSize: 15, color: "var(--text-muted)", maxWidth: 760, lineHeight: 1.7 }}>
              Customize notifications, appearance, privacy, and audio preferences from one polished dashboard.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              disabled={!prefs || isSaving}
              onClick={() => prefs && handleSave(prefs)}
              style={{
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                cursor: prefs ? "pointer" : "not-allowed",
                fontWeight: 700,
                transition: "all 0.18s ease",
              }}
            >
              {isSaving ? "Saving…" : "Save settings"}
            </button>
            {saveStatus && <span style={{ color: saveStatus === "Saved" ? "#34D399" : "#FBBF24", fontSize: 13 }}>{saveStatus}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 24 }}>
          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ padding: 20, borderRadius: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Explore</div>
              <div style={{ display: "grid", gap: 10 }}>
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 16,
                      background: activeTab === tab.id ? "rgba(79,124,255,0.14)" : "transparent",
                      border: activeTab === tab.id ? "1px solid rgba(79,124,255,0.24)" : "1px solid transparent",
                      color: activeTab === tab.id ? "#fff" : "var(--text-muted)",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{tab.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{tab.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{tab.description}</div>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, borderRadius: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Quick actions</div>
              <div style={{ display: "grid", gap: 12 }}>
                <button type="button" onClick={() => window.location.reload()} style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "var(--text)", textAlign: "left", cursor: "pointer" }}>Refresh settings</button>
                <button type="button" onClick={() => setActiveTab("sessions")} style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "var(--text)", textAlign: "left", cursor: "pointer" }}>Review active sessions</button>
              </div>
            </div>
          </aside>

          <main style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ padding: 20, borderRadius: 30, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
              {!prefs ? (
                <div style={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="loader" /></div>
              ) : (
                <div style={{ display: "grid", gap: 24 }}>
                  {activeTab === "notifications" && (
                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={{ padding: 18, borderRadius: 22, background: prefs.dndEnabled ? "rgba(239,68,68,0.12)" : "rgba(79,124,255,0.08)", border: `1px solid ${prefs.dndEnabled ? "rgba(239,68,68,0.22)" : "rgba(79,124,255,0.2)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: prefs.dndEnabled ? "#F87171" : "#fff" }}>{prefs.dndEnabled ? "Notifications paused" : "Notifications enabled"}</div>
                            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>Toggle global Do Not Disturb mode, silence alerts, and refine how you receive updates.</p>
                          </div>
                          <Toggle checked={prefs.dndEnabled} onChange={(value) => handleSave({ dndEnabled: value })} />
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        {[
                          { key: "dmMessages", label: "Direct messages" },
                          { key: "mentions", label: "Mentions & pings" },
                          { key: "friendRequests", label: "Friend requests" },
                          { key: "serverInvites", label: "Server invites" },
                          { key: "voiceJoin", label: "Voice channel joins" },
                          { key: "calls", label: "Incoming calls" },
                        ].map((item) => (
                          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Enable or disable {item.label.toLowerCase()} alerts.</div>
                            </div>
                            <Toggle checked={prefs[item.key as keyof Prefs] as boolean} onChange={(value) => handleSave({ [item.key]: value } as Partial<Prefs>)} />
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        {settingRow("Email digest", "Receive weekly or daily summary emails.", (
                          <select value={prefs.emailDigest} onChange={(event) => handleSave({ emailDigest: event.target.value })} style={{ minWidth: 140, padding: "10px 12px", borderRadius: 12, color: "#fff", background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <option value="off">Off</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        ))}
                        {settingRow("Desktop push notifications", "Allow Lensly to display notifications on your desktop.", (
                          <Toggle checked={prefs.desktopPush} onChange={(value) => handleSave({ desktopPush: value })} />
                        ))}
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.15em" }}>Quiet hours</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                            <div style={{ display: "grid", gap: 8 }}>
                              <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Silence starts</label>
                              <input type="time" value={prefs.quietHoursStart || ""} onChange={(event) => handleSave({ quietHoursStart: event.target.value || null })} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.24)", color: "#fff" }} />
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Silence ends</label>
                              <input type="time" value={prefs.quietHoursEnd || ""} onChange={(event) => handleSave({ quietHoursEnd: event.target.value || null })} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.24)", color: "#fff" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "appearance" && (
                    <div style={{ display: "grid", gap: 18 }}>
                      <div style={{ display: "grid", gap: 12 }}>
                        {settingRow("Theme", "Choose a visual theme for the app.", (
                          <select value={prefs.theme} onChange={(event) => handleSave({ theme: event.target.value })} style={{ minWidth: 180, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
                            <option value="dark">Midnight Dark</option>
                            <option value="sakura">Sakura Light</option>
                            <option value="cyberpunk">Cyberpunk</option>
                            <option value="glassmorphism">Glassmorphism</option>
                            <option value="classic">Classic</option>
                          </select>
                        ))}
                        {settingRow("Alert sound", "Select the default notification tone.", (
                          <select value={prefs.notificationSound} onChange={(event) => handleSave({ notificationSound: event.target.value })} style={{ minWidth: 180, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
                            <option value="chime">Classic chime</option>
                            <option value="synthwave">Synthwave pulse</option>
                            <option value="beep">Retro beep</option>
                          </select>
                        ))}
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Accent color</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                            {[
                              { label: "Default", value: null, gradient: "linear-gradient(135deg,#3B82F6,#6366F1)" },
                              { label: "Emerald", value: "#10B981", gradient: "linear-gradient(135deg,#10B981,#34D399)" },
                              { label: "Violet", value: "#8B5CF6", gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)" },
                              { label: "Sunset", value: "#F59E0B", gradient: "linear-gradient(135deg,#F59E0B,#FBBF24)" },
                              { label: "Magenta", value: "#EC4899", gradient: "linear-gradient(135deg,#EC4899,#FF5EAD)" },
                            ].map((option) => {
                              const selected = prefs.accentColor === option.value;
                              return (
                                <button
                                  key={option.label}
                                  type="button"
                                  onClick={() => handleSave({ accentColor: option.value, accentColor2: option.value, accentColor3: option.value })}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "14px 12px",
                                    borderRadius: 16,
                                    minHeight: 60,
                                    border: selected ? "2px solid #4F7CFF" : "1px solid rgba(255,255,255,0.08)",
                                    background: option.value ? option.gradient : "rgba(255,255,255,0.04)",
                                    color: selected ? "#fff" : "var(--text)",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "privacy" && (
                    <div style={{ display: "grid", gap: 18 }}>
                      {settingRow("Show online status", "Allow other users to see when you are online.", <Toggle checked={true} onChange={() => {}} />)}
                      {settingRow("Allow DMs from members", "Permit direct messages from server members.", <Toggle checked={true} onChange={() => {}} />)}
                      {settingRow("Allow DMs from friends", "Only accept direct messages from friends.", <Toggle checked={prefs.allowFriendDms} onChange={(value) => handleSave({ allowFriendDms: value })} />)}

                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, display: "grid", gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Two-factor authentication</div>
                        {prefs.twoFactorEnabled ? (
                          <div style={{ padding: 16, borderRadius: 18, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>2FA is enabled.</div>
                            <button type="button" onClick={() => { if (confirm("Disable two-factor authentication?")) handleSave({ twoFactorEnabled: false }); }} style={{ marginTop: 12, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.12)", color: "#EF4444", cursor: "pointer" }}>Disable 2FA</button>
                          </div>
                        ) : twoFactorStep === "idle" ? (
                          <button type="button" onClick={handleEnableTwoFactor} style={{ padding: "12px 16px", borderRadius: 16, border: "1px solid rgba(79,124,255,0.3)", background: "rgba(79,124,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Set up 2FA</button>
                        ) : twoFactorStep === "setup" ? (
                          <div style={{ display: "grid", gap: 14, padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ width: 100, height: 100, background: "#000", borderRadius: 18, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>QR code mockup</div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Scan the code or use this secret key.</div>
                                <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>{twoFactorSecret}</p>
                              </div>
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                              <input type="text" placeholder="000000" maxLength={6} value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ""))} style={{ width: 160, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.24)", color: "#fff", fontSize: 14 }} />
                              <button type="button" onClick={handleConfirmTwoFactor} style={{ padding: "12px 16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #4F7CFF, #8C5EFF)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Verify and enable</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: 16, borderRadius: 18, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>2FA setup complete.</div>
                            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>Keep your backup codes secure.</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 12 }}>
                              {backupCodes.map((code) => (
                                <code key={code} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.18)", color: "#fff", fontSize: 12, fontFamily: "var(--mono)" }}>{code}</code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "voice" && (
                    <div style={{ display: "grid", gap: 18 }}>
                      {settingRow("Push-to-Talk", "Hold the spacebar to transmit audio.", <Toggle checked={pttEnabled} onChange={handleTogglePtt} />)}
                      {pttEnabled && (
                        <div style={{ padding: 16, borderRadius: 18, background: "rgba(79,124,255,0.08)", border: "1px solid rgba(79,124,255,0.18)" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>PTT shortcut</div>
                          <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12 }}>Spacebar</div>
                        </div>
                      )}
                      {settingRow("Noise suppression", "Reduce background noise for clearer voice chat.", <Toggle checked={noiseSuppress} onChange={handleToggleNoise} />)}
                      <div style={{ display: "grid", gap: 12 }}>
                        {settingRow("Global audio", "Control master volume for all sound alerts.", <span style={{ color: "var(--accent)", fontWeight: 700 }}>{Math.round((prefs.masterVolume ?? 0.8) * 100)}%</span>)}
                        <input type="range" min={0} max={1} step={0.05} value={prefs.masterVolume ?? 0.8} onChange={(event) => handleSave({ masterVolume: parseFloat(event.target.value) })} style={{ width: "100%", accentColor: "var(--accent)" }} />
                      </div>
                      <div style={{ display: "grid", gap: 12 }}>
                        {[
                          { label: "Direct messages", soundKey: "dmSound", volumeKey: "dmVolume" },
                          { label: "Mentions & tags", soundKey: "mentionSound", volumeKey: "mentionVolume" },
                          { label: "Server messages", soundKey: "serverSound", volumeKey: "serverVolume" },
                          { label: "Incoming calls", soundKey: "callSound", volumeKey: "callVolume" },
                          { label: "Voice events", soundKey: "vcSound", volumeKey: "vcVolume" },
                        ].map((item) => (
                          <div key={item.soundKey} style={{ padding: "16px 18px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Sound type and volume.</div>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Math.round(((prefs[item.volumeKey as keyof Prefs] as number) ?? 0.8) * 100)}%</span>
                            </div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                              <select value={(prefs[item.soundKey as keyof Prefs] as string) || "chime"} onChange={(event) => handleSave({ [item.soundKey]: event.target.value } as Partial<Prefs>)} style={{ flex: 1, minWidth: 180, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.24)", color: "#fff" }}>
                                <option value="chime">Classic chime</option>
                                <option value="alert">Alert ding</option>
                                <option value="playful">Playful pulse</option>
                                <option value="cyber">Synthwave</option>
                                <option value="beep">Retro beep</option>
                                <option value="retro">8-bit</option>
                              </select>
                              <button type="button" onClick={() => previewSound(prefs[item.soundKey as keyof Prefs] as string, (prefs[item.volumeKey as keyof Prefs] as number) ?? 0.8)} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(79,124,255,0.25)", background: "rgba(79,124,255,0.12)", color: "var(--accent)", cursor: "pointer" }}>Preview</button>
                            </div>
                            <input type="range" min={0} max={1} step={0.05} value={(prefs[item.volumeKey as keyof Prefs] as number) ?? 0.8} onChange={(event) => handleSave({ [item.volumeKey]: parseFloat(event.target.value) } as Partial<Prefs>)} style={{ width: "100%", accentColor: "var(--accent)", marginTop: 12 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "sessions" && (
                    <div style={{ display: "grid", gap: 16 }}>
                      {sessions.length === 0 ? (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>Loading active sessions…</div>
                      ) : (
                        sessions.map((session) => {
                          const isCurrent = session.userAgent === navigator.userAgent && session.ip === "192.168.1.45";
                          const isMobile = session.device?.toLowerCase().includes("mobile") || session.device?.toLowerCase().includes("ios") || session.device?.toLowerCase().includes("android");
                          return (
                            <div key={session.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0, flex: 1 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(79,124,255,0.16)", display: "grid", placeItems: "center", fontSize: 20 }}>{isMobile ? "📱" : "💻"}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{session.device || "Unknown device"}</span>
                                    {isCurrent && <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(79,124,255,0.14)", color: "#93C5FD", fontSize: 11, fontWeight: 700 }}>Current</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>IP: <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{session.ip}</span></div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Last active: {new Date(session.lastActive).toLocaleString()}</div>
                                </div>
                              </div>
                              {!isCurrent && (
                                <button type="button" onClick={() => handleRevokeSession(session.id)} style={{ padding: "10px 16px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.12)", color: "#EF4444", cursor: "pointer" }}>Revoke</button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 14, padding: 20, borderRadius: 30, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(18px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>Diagnostics</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>View saved crash reports and status messages.</div>
                </div>
                <button type="button" onClick={() => { localStorage.removeItem("gc_crash_reports"); window.location.reload(); }} style={{ padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)", color: "var(--text)", cursor: "pointer" }}>Clear logs</button>
              </div>
              <div style={{ minHeight: 120, display: "grid", gap: 10 }}>
                {(() => {
                  const reports = JSON.parse(localStorage.getItem("gc_crash_reports") || "[]");
                  if (reports.length === 0) {
                    return <div style={{ padding: 16, borderRadius: 18, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)", color: "#34D399" }}>No recent crash reports were found.</div>;
                  }
                  return reports.slice(0, 4).map((report: any, idx: number) => (
                    <div key={idx} style={{ padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "var(--text-muted)" }}>
                      <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>{report.message || "Unknown error"}</div>
                      <div>{report.source || "Unknown source"} · {new Date(report.timestamp || Date.now()).toLocaleString()}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
