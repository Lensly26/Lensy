import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation, Link } from "react-router-dom";
import { ApplicantAreaPage } from "./pages/ApplicantAreaPage.js";
import { useAuthStore } from "./lib/auth-store.js";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./lib/firebase.js";
import { UpdateBanner } from "./lib/UpdateBanner.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { VerifyEmailPage } from "./pages/VerifyEmailPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import { MainLayout } from "./pages/MainLayout.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { AdminPage } from "./pages/AdminPage.js";
import { StatusPage } from "./pages/StatusPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { MaintenancePage } from "./pages/MaintenancePage.js";
import { StatsPage } from "./pages/StatsPage.js";
import { UpdatePage } from "./pages/UpdatePage.js";
import { SupportPage } from "./pages/SupportPage.js";
import { DownloadPage } from "./pages/DownloadPage.js";
import { PremiumPage } from "./pages/PremiumPage.js";


function Protected({ children, maintenanceMode }: { children: React.ReactNode, maintenanceMode: boolean }) {
  const access = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.me);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  if (isInitializing) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="loader"></div></div>;
  if (!access) return <Navigate to="/login" replace />;
  
  if (maintenanceMode && (!me?.role || me.role === "USER")) return <Navigate to="/maintenance" replace />;
  if (me?.accountStatus === "SUSPENDED" || me?.accountStatus === "TERMINATED") return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.hydrate);
  const me = useAuthStore((s) => s.me);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  // Sync and apply custom theme & accent color from settings
  useEffect(() => {
    if (!me?.id) {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--accent-2");
      document.documentElement.style.removeProperty("--accent-3");
      return;
    }
    const unsub = onSnapshot(doc(db, "settings", me.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const theme = data.theme || "dark";
        document.documentElement.setAttribute("data-theme", theme);

        if (data.accentColor) {
          document.documentElement.style.setProperty("--accent", data.accentColor);
          document.documentElement.style.setProperty("--accent-2", data.accentColor2 || data.accentColor);
          document.documentElement.style.setProperty("--accent-3", data.accentColor3 || data.accentColor);
        } else {
          document.documentElement.style.removeProperty("--accent");
          document.documentElement.style.removeProperty("--accent-2");
          document.documentElement.style.removeProperty("--accent-3");
        }
      }
    });
    return () => unsub();
  }, [me?.id]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "config"), (snap) => {
      if (snap.exists()) {
        setMaintenanceMode(snap.data().maintenanceMode);
      }
    }, (err) => {
      console.warn("Could not read system config (likely unauthenticated):", err.message);
    });
    return () => unsub();
  }, [me?.id]);

  const isStaff = (me?.role && ["TRIAL_MODERATOR", "MODERATOR", "ADMIN", "MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase())) || me?.admin;
  const canViewAdmin = isInitializing ? true : isStaff;
  const isDevBypass = window.location.search.includes("dev=bypass");
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isMaintenanceRoute = location.pathname === "/maintenance";
    const isAuthorized = canViewAdmin || isDevBypass;

    if (maintenanceMode && !isAuthorized && !isMaintenanceRoute) {
      // Lockout unauthorized users
      navigate("/maintenance", { replace: true });
    } else if (isMaintenanceRoute && (!maintenanceMode || isAuthorized)) {
      // Pull authorized users (or everyone if it's off) out of the maintenance page
      navigate("/app", { replace: true });
    }
  }, [maintenanceMode, canViewAdmin, isDevBypass, location.pathname, navigate]);

  // Auto update redirects: when a staging update goes live or pending, send users to the update panel
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "update_staging"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const allowedRoutes = ["/update", "/download", "/support"];
        if (data.updateLive) {
          const appliedVersion = localStorage.getItem("applied_update_version");
          if (appliedVersion !== data.version && !allowedRoutes.includes(location.pathname) && data.forceUpdate !== false) {
            navigate("/update", { replace: true });
          }
        } else if (data.updatePending) {
          if (!sessionStorage.getItem("update_seen") && !allowedRoutes.includes(location.pathname) && data.forceUpdate !== false) {
            sessionStorage.setItem("update_seen", "true");
            navigate("/update", { replace: true });
          }
        }
      }
    }, (err) => console.warn("Update staging read error:", err.message));
    return () => unsub();
  }, [location.pathname, navigate]);

  return (
    <>
      <UpdateBanner />
      <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/update" element={<UpdatePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route
        path="/stats"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <StatsPage />
          </Protected>
        }
      />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route
        path="/premium"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <PremiumPage />
          </Protected>
        }
      />

      <Route
        path="/app/*"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <MainLayout />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <SettingsPage />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <ProfilePage />
          </Protected>
        }
      />
      <Route
        path="/shop"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <div className="app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100vh", background: "var(--bg-deep)", color: "var(--text)" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
              <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, background: "linear-gradient(135deg, #4F7CFF, #8C5EFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lensly Shop</h1>
              <p style={{ color: "var(--text-muted)", marginBottom: 28, fontSize: 18, fontWeight: 600 }}>Coming soon</p>
              <Link to="/app" className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 14 }}>← Back to App</Link>
            </div>
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            {isInitializing ? (
              <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
            ) : canViewAdmin ? (
              <AdminPage />
            ) : (
              <Navigate to="/app" replace />
            )}
          </Protected>
        }
      />
      <Route
        path="/apply"
        element={
          <Protected maintenanceMode={maintenanceMode}>
            <ApplicantAreaPage />
          </Protected>
        }
      />
    </Routes>
    </>
  );
}
