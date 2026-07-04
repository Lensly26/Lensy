import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase.js";

export function UpdatePage() {
  const [stagingData, setStagingData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "update_staging"), (snap) => {
      if (snap.exists()) {
        setStagingData(snap.data());
      } else {
        setStagingData(null);
      }
    }, (err) => console.warn("Update page read error:", err.message));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!stagingData?.scheduledTime || stagingData?.updateLive) return;

    const interval = setInterval(() => {
      const diff = new Date(stagingData.scheduledTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Going live right now…");
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}m ${s}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [stagingData?.scheduledTime, stagingData?.updateLive]);

  function applyUpdate() {
    if (stagingData?.version) {
      localStorage.setItem("applied_update_version", stagingData.version);
    }
    window.location.href = "/app";
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text)", padding: 24,
      fontFamily: "var(--font-sans)"
    }}>
      <div style={{
        background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20,
        padding: "40px", maxWidth: 620, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        textAlign: "center", position: "relative", overflow: "hidden"
      }}>
        {/* Top Glow Accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 6,
          background: stagingData?.updateLive ? "linear-gradient(90deg, #34D399, #10B981)" : "linear-gradient(90deg, #F59E0B, #D97706)"
        }} />

        <div style={{ fontSize: 56, marginBottom: 20 }}>
          {stagingData?.updateLive ? "🎉" : "⏳"}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: stagingData?.updateLive ? "#34D399" : "#F59E0B" }}>
          {stagingData?.updateLive ? "Waiting for update" : "Waiting for latest release"}
        </h1>

        {stagingData?.version && (
          <div style={{ background: "var(--bg-elevated)", padding: "8px 16px", borderRadius: 20, display: "inline-block", fontSize: 14, fontWeight: 700, color: "var(--accent)", marginBottom: 16 }}>
            {stagingData.version}
          </div>
        )}

        <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "10px 20px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#34D399" }}>
            Today's Deployed Patches: {stagingData?.updatesTodayCount || 1} update{stagingData?.updatesTodayCount > 1 ? "s" : ""} deployed today
          </span>
        </div>

        {stagingData?.description ? (
          <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 32, textAlign: "left", background: "var(--bg-elevated)", padding: 20, borderRadius: 12, border: "1px solid var(--border)" }}>
            {stagingData.description}
          </p>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 32 }}>
            No pending updates or changelogs are available at this time.
          </p>
        )}

        {stagingData?.updatePending && !stagingData?.updateLive && (
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "20px", borderRadius: 14, marginBottom: 32 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#F59E0B", fontWeight: 700, marginBottom: 6 }}>
              Automated Rollout Countdown
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>
              {timeLeft || "Calculating…"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              Scheduled Live Time: {stagingData.scheduledTime ? new Date(stagingData.scheduledTime).toLocaleString() : "—"}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {stagingData?.updateLive ? (
            <button onClick={applyUpdate} className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, fontWeight: 700, background: "#10B981", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 8px 16px rgba(16,185,129,0.3)" }}>
              🔄 Apply Update & Reload Lensly
            </button>
          ) : (
            <Link to="/app" className="btn btn-primary" style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, borderRadius: 12 }}>
              ← Continue to App
            </Link>
          )}
          <Link to="/download" className="btn btn-ghost" style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 12 }}>
            📥 Download Desktop Client
          </Link>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          📅 <b>Official Lensly Release Schedule:</b> Major feature updates roll out every Friday. Bug fixes and minor patches roll out daily.
        </div>
      </div>
    </div>
  );
}
