import { Link } from "react-router-dom";

export function DownloadPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text)",
      fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column"
    }}>
      {/* Top Navbar */}
      <header style={{
        background: "rgba(10,10,14,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)",
        padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚀</span>
          <span style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg,#fff,#aaa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Lensly Download Hub
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/support" className="btn btn-ghost" style={{ fontSize: 14, fontWeight: 700 }}>
            Support Center
          </Link>
          <Link to="/app" className="btn btn-primary" style={{ fontSize: 14, fontWeight: 700, borderRadius: 8, padding: "8px 16px" }}>
            Open Web App
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1000, width: "100%", margin: "0 auto", padding: "48px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 48 }}>
        {/* Hero Section */}
        <section style={{ textAlign: "center", position: "relative", padding: "20px 0" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, background: "var(--accent)", filter: "blur(150px)", opacity: 0.15, pointerEvents: "none" }} />
          <div style={{ fontSize: 56, marginBottom: 16 }}>📥</div>
          <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16, letterSpacing: "-0.03em" }}>
            Download Lensly Desktop
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-muted)", maxWidth: 600, margin: "0 auto 32px" }}>
            Choose your preferred installation method below to experience Lensly's lightning-fast desktop performance, rich presence, and native notifications.
          </p>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
          {/* Option 1: Standalone Desktop Installer */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 24, padding: 36, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>📦</span>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>Standalone Desktop Installer</h2>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Download the official Lensly standalone desktop installer. Installs Lensly directly to your system with built-in auto-updates, rich presence, and hardware acceleration.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a href="/Lensly-Setup-2.9.2.exe" download="Lensly-Setup-2.9.2.exe" className="btn btn-primary" style={{ width: "100%", padding: "16px", fontSize: 16, fontWeight: 800, background: "#10B981", color: "#fff", border: "none", borderRadius: 14, textAlign: "center", textDecoration: "none", display: "block", boxShadow: "0 8px 20px rgba(16,185,129,0.3)" }}>
                📥 Download for Windows (.exe)
              </a>
              <a href="/Lensly-2.9.2.dmg" download="Lensly-2.9.2.dmg" className="btn btn-ghost" style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 14, textAlign: "center", textDecoration: "none", display: "block" }}>
                🍏 Download for macOS (.dmg)
              </a>
            </div>
          </div>

          {/* Option 3: Tauri Native Build */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 24, padding: 36, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>🦀</span>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>Tauri Native Client (Dev)</h2>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
                For developers and advanced users. Build the ultra-lightweight Tauri desktop client locally using Rust and Node.js.
              </p>
              <div style={{ background: "var(--bg-deep)", padding: "12px 16px", borderRadius: 12, fontFamily: "monospace", fontSize: 13, color: "#34D399", border: "1px solid var(--border)", marginBottom: 24 }}>
                git clone https://github.com/Lensly25/Lensly.git<br/>
                cd Lensly/apps/desktop<br/>
                npm run tauri:dev
              </div>
            </div>
            <a href="https://github.com/Lensly25/Lensly" target="___blank" rel="noreferrer" className="btn btn-ghost" style={{ width: "100%", padding: "16px", fontSize: 16, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 14, textAlign: "center", textDecoration: "none", display: "block" }}>
              🔗 View GitHub Repository
            </a>
          </div>
        </div>

        {/* System Requirements Banner */}
        <section style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 36 }}>💻</div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>System Requirements</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
              <b>OS:</b> Windows 10/11, macOS 11+, or Linux (Ubuntu 20.04+). <b>Memory:</b> 4GB RAM minimum. <b>Storage:</b> 150MB available space. <b>Network:</b> Broadband internet connection.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", gap: 24 }}>
          <Link to="/app" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Open App</Link>
          <Link to="/support" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Support Center</Link>
          <Link to="/status" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>System Status</Link>
          <Link to="/stats" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>Platform Stats</Link>
        </div>
        <div>© 2026 Lensly Inc. All rights reserved. Official Lensly Download & Distribution Hub.</div>
      </footer>
    </div>
  );
}
