import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { useAuthStore } from "../lib/auth-store.js";
import { Link } from "react-router-dom";

export function StatsPage() {
  const [stats, setStats] = useState({ users: 0, servers: 0, channels: 0 });
  const [loading, setLoading] = useState(true);
  const me = useAuthStore((s) => s.me);
  const isDeveloper = me?.role && ["DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());

  useEffect(() => {
    if (!isDeveloper) return;
    async function loadStats() {
      try {
        const [usersSnap, serversSnap, channelsSnap] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "guilds")),
          getCountFromServer(collection(db, "channels")),
        ]);
        
        setStats({
          users: usersSnap.data().count,
          servers: serversSnap.data().count,
          channels: channelsSnap.data().count,
        });
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [isDeveloper]);

  if (!isDeveloper) {
    return (
      <div style={{ minHeight: "100vh", padding: 28, maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Access Denied</div>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Only developers can view platform statistics.</div>
        <Link to="/app" className="btn btn-primary" style={{ marginTop: 8 }}>Return to App</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 28, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: "-0.02em" }}>Platform Statistics</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 15 }}>
            Real-time metrics of the Lensly network
          </p>
        </div>
        <Link to="/app" className="btn btn-ghost" style={{ fontSize: 13 }}>← Back to App</Link>
      </div>

      <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
        {loading ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 32 }}>
            Loading statistics...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div
              style={{
                padding: 24,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
                textAlign: "center"
              }}
            >
              <h3 style={{ color: "var(--text-muted)", margin: "0 0 8px", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Users</h3>
              <div style={{ fontSize: 48, fontWeight: 800, color: "var(--brand)" }}>{stats.users}</div>
            </div>
            
            <div
              style={{
                padding: 24,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
                textAlign: "center"
              }}
            >
              <h3 style={{ color: "var(--text-muted)", margin: "0 0 8px", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Servers</h3>
              <div style={{ fontSize: 48, fontWeight: 800, color: "var(--brand)" }}>{stats.servers}</div>
            </div>
            
            <div
              style={{
                padding: 24,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: "1px solid var(--border-subtle)",
                textAlign: "center"
              }}
            >
              <h3 style={{ color: "var(--text-muted)", margin: "0 0 8px", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Channels</h3>
              <div style={{ fontSize: 48, fontWeight: 800, color: "var(--brand)" }}>{stats.channels}</div>
            </div>
          </div>
        )}
      </div>

      <div className="glass" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>About Statistics</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          These statistics represent the current size and scale of the Lensly community. 
          Data is retrieved directly from our database and reflects the absolute total counts.
        </p>
      </div>
    </div>
  );
}
