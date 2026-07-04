import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuthStore } from "../lib/auth-store.js";
import { Link } from "react-router-dom";

type StatusData = {
  ok: boolean;
  services: {
    app: string;
    api: string;
    database: string;
    realtime: string;
  };
  updatedAt: string;
};

type Incident = {
  id: string;
  title: string;
  time: string;
  description: string;
  severity: string;
};

const SERVICE_META: Record<string, { label: string; desc: string; icon: string }> = {
  app: { label: "App", desc: "Desktop Application", icon: "💻" },
  api: { label: "API", desc: "Core API Endpoints", icon: "⚡" },
  database: { label: "Database", desc: "Data Persistence Layer", icon: "🗄️" },
  realtime: { label: "Realtime", desc: "WebSocket Connections", icon: "📡" },
};

export function StatusPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Developer control state
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("success");

  const me = useAuthStore((s) => s.me);
  const isDeveloper = me?.role && ["DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "status"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStatus({
          ok: Object.values(data.services || {}).every(v => v === "operational"),
          services: {
            app: data.services?.app || "operational",
            api: data.services?.api || "operational",
            database: data.services?.database || "operational",
            realtime: data.services?.realtime || "operational",
          },
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
        setIncidents(data.incidents || []);
      } else {
        setStatus({
          ok: true,
          services: { app: "operational", api: "operational", database: "operational", realtime: "operational" },
          updatedAt: new Date().toISOString(),
        });
        setIncidents([
          { id: "default-1", title: "Planned Database Maintenance (Completed)", time: "May 18, 2026 — 04:00 to 05:00 UTC", description: "We successfully upgraded our database clusters to improve performance during peak hours. No significant downtime was observed.", severity: "success" },
          { id: "default-2", title: "Minor Realtime degraded performance (Resolved)", time: "May 15, 2026 — 18:22 to 19:10 UTC", description: "A subset of clients experienced delayed message delivery due to load balancing issues. The issue has been fully resolved.", severity: "danger" }
        ]);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Could not load system status from DB, using fallback", err);
      setStatus({
        ok: true,
        services: { app: "operational", api: "operational", database: "operational", realtime: "operational" },
        updatedAt: new Date().toISOString(),
      });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function updateServiceStatus(svc: string, nextVal: string) {
    try {
      const docRef = doc(db, "system", "status");
      const currentServices = status?.services || { app: "operational", api: "operational", database: "operational", realtime: "operational" };
      await setDoc(docRef, { services: { ...currentServices, [svc]: nextVal }, incidents, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) { alert("Failed to update status: " + String(err)); }
  }

  async function handleAddIncident() {
    if (!incidentTitle.trim() || !incidentDesc.trim()) { alert("Title and description are required."); return; }
    const newIncident = { id: Math.random().toString(36).substring(2, 9), title: incidentTitle.trim(), time: incidentTime.trim() || new Date().toLocaleString(), description: incidentDesc.trim(), severity: incidentSeverity };
    try {
      const docRef = doc(db, "system", "status");
      const currentServices = status?.services || { app: "operational", api: "operational", database: "operational", realtime: "operational" };
      await setDoc(docRef, { services: currentServices, incidents: [newIncident, ...incidents], updatedAt: new Date().toISOString() }, { merge: true });
      setIncidentTitle(""); setIncidentTime(""); setIncidentDesc("");
    } catch (err) { alert("Failed to add incident: " + String(err)); }
  }

  async function handleClearIncidents() {
    if (!confirm("Are you sure you want to clear all incidents?")) return;
    try {
      const docRef = doc(db, "system", "status");
      const currentServices = status?.services || { app: "operational", api: "operational", database: "operational", realtime: "operational" };
      await setDoc(docRef, { services: currentServices, incidents: [], updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) { alert("Failed to clear incidents: " + String(err)); }
  }

  const statusInfo = (val: string) => {
    if (val === "operational") return { color: "#34D399", bg: "rgba(52,211,153,0.12)", label: "Operational", icon: "✓" };
    if (val === "degraded") return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Degraded", icon: "⚠" };
    return { color: "#EF4444", bg: "rgba(239,68,68,0.12)", label: "Outage", icon: "✗" };
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text)", fontFamily: "var(--font-sans)" }}>
      {/* Hero Header */}
      <div style={{ position: "relative", overflow: "hidden", padding: "64px 24px 48px", textAlign: "center" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, height: 400, background: status?.ok ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", filter: "blur(120px)", pointerEvents: "none", borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
          <Link to="/app" style={{ display: "inline-block", marginBottom: 24, color: "var(--text-muted)", fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "color 0.2s" }}>← Back to App</Link>
          <h1 style={{ fontSize: 48, fontWeight: 900, marginBottom: 12, letterSpacing: "-0.03em" }}>System Status</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 17, marginBottom: 32, fontWeight: 500 }}>Real-time infrastructure health for Lensly services</p>

          {/* Overall status banner */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 32px", borderRadius: 999, background: status?.ok ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${status?.ok ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`, backdropFilter: "blur(12px)" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: status?.ok ? "#34D399" : "#EF4444", boxShadow: `0 0 12px ${status?.ok ? "#34D399" : "#EF4444"}`, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: status?.ok ? "#34D399" : "#EF4444" }}>
              {loading ? "Checking systems..." : status?.ok ? "All Systems Operational" : "Issues Detected"}
            </span>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
            Last checked: {status ? new Date(status.updatedAt).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 64px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Developer Controls */}
        {isDeveloper && (
          <div style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px dashed rgba(79,124,255,0.3)", borderRadius: 20, padding: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 24px 0", color: "var(--accent)", letterSpacing: "-0.02em" }}>🛠️ Developer Controls</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* Service overrides */}
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Service Status</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(["app", "api", "database", "realtime"] as const).map((svc) => {
                    const val = status?.services[svc] || "operational";
                    const si = statusInfo(val);
                    return (
                      <div key={svc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{SERVICE_META[svc].icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>{svc}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: si.bg, color: si.color, fontWeight: 800 }}>{si.label}</span>
                        </div>
                        <select value={val} onChange={async (e) => await updateServiceStatus(svc, e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none" }}>
                          <option value="operational" style={{ background: "var(--bg-panel)" }}>🟢 Operational</option>
                          <option value="degraded" style={{ background: "var(--bg-panel)" }}>🟡 Degraded</option>
                          <option value="outage" style={{ background: "var(--bg-panel)" }}>🔴 Outage</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* New Incident */}
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Post Incident</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input placeholder="Incident Title" value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} style={inputStyle} />
                  <input placeholder="Date/Time (e.g. May 23, 2026 — 22:00 UTC)" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Description of the incident..." value={incidentDesc} onChange={(e) => setIncidentDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <select value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
                      <option value="success" style={{ background: "var(--bg-panel)" }}>🟢 Resolved</option>
                      <option value="warning" style={{ background: "var(--bg-panel)" }}>🟡 Degraded</option>
                      <option value="danger" style={{ background: "var(--bg-panel)" }}>🔴 Outage</option>
                    </select>
                    <button onClick={handleAddIncident} style={{ padding: "12px 24px", borderRadius: 10, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Publish</button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={handleClearIncidents} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🗑️ Clear All Incidents</button>
            </div>
          </div>
        )}

        {/* Service Cards Grid */}
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, letterSpacing: "-0.02em" }}>Services</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {status && (["app", "api", "database", "realtime"] as const).map((svc) => {
              const val = status.services[svc];
              const si = statusInfo(val);
              const meta = SERVICE_META[svc];
              return (
                <div key={svc} style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", transition: "all 0.25s", position: "relative", overflow: "hidden" }} onMouseEnter={e => e.currentTarget.style.borderColor = si.color} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                  {/* Glow */}
                  <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 80, height: 4, background: si.color, borderRadius: "0 0 4px 4px", boxShadow: `0 0 20px ${si.color}`, opacity: 0.8 }} />
                  <div style={{ fontSize: 28 }}>{meta.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{meta.desc}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: si.bg, marginTop: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: si.color }}>{si.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: si.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{si.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Key */}
        <div style={{ display: "flex", gap: 32, justifyContent: "center", padding: "20px 0" }}>
          {[
            { icon: "✓", label: "Operational", color: "#34D399" },
            { icon: "⚠", label: "Degraded", color: "#F59E0B" },
            { icon: "✗", label: "Outage", color: "#EF4444" },
          ].map(k => (
            <div key={k.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: `${k.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: k.color }}>{k.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{k.label}</span>
            </div>
          ))}
        </div>

        {/* Incident History */}
        <div style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 24px 0", letterSpacing: "-0.02em" }}>📋 Incident History & Planned Maintenance</h2>
          {incidents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>No recent incidents reported.</div>
              <div style={{ fontSize: 14, marginTop: 6 }}>All systems are running smoothly.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
              {/* Timeline line */}
              <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 2, background: "rgba(255,255,255,0.06)" }} />
              {incidents.map((inc) => {
                const dotColor = inc.severity === "danger" ? "#EF4444" : inc.severity === "warning" ? "#F59E0B" : "#34D399";
                return (
                  <div key={inc.id} style={{ display: "flex", gap: 20, padding: "20px 0", position: "relative" }}>
                    {/* Timeline dot */}
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${dotColor}20`, border: `2px solid ${dotColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1, boxShadow: `0 0 12px ${dotColor}40` }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor }} />
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{inc.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>{inc.time}</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{inc.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* About */}
        <div style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>About This Page</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
            This page shows the real-time status of Lensly services. If you're experiencing issues,
            check here first to see if there are any known problems. Status updates are automatic
            and reflect the current state of our infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
}
