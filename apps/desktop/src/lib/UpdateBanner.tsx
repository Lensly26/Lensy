import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function UpdateBanner() {
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check for updates 3s after launch
    const t = setTimeout(async () => {
      try {
        const msg = await invoke<string>("check_update");
        if (msg && msg !== "Up to date") {
          setUpdateMsg(msg);
        }
      } catch {
        // Tauri not available (web mode) — skip
      }
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!updateMsg) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
      background: "linear-gradient(90deg, rgba(79,124,255,0.95), rgba(140,94,255,0.95))",
      padding: "10px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 13, fontWeight: 600, color: "#fff",
      backdropFilter: "blur(8px)",
    }}>
      <span>🔄 {updateMsg} — Restart to update</span>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{ background: "#fff", color: "#4F7CFF", border: "none", borderRadius: 6, padding: "5px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
          disabled={installing}
          onClick={async () => {
            setInstalling(true);
            try { await invoke("install_update"); } catch { setInstalling(false); }
          }}
        >
          {installing ? "Installing…" : "Install & Restart"}
        </button>
        <button
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}
          onClick={() => setUpdateMsg(null)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
