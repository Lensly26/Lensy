import { useAuthStore } from "../lib/auth-store.js";

export function MaintenancePage() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-deep)", color: "var(--text)" }}>
      <img src="/maintenance.png" alt="Maintenance" style={{ width: 120, height: 120, marginBottom: 24, objectFit: "contain" }} />
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>🚧 Maintenance in progress</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, maxWidth: 450, textAlign: "center", lineHeight: 1.6 }}>
        Our system is currently undergoing scheduled maintenance to improve performance and stability. We’ll be back online shortly. Thanks for your patience.
      </p>
      <button className="btn btn-primary" onClick={() => void logout()}>Log Out</button>
    </div>
  );
}
