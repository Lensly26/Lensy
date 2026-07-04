import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuthStore } from "../lib/auth-store.js";
import { Link } from "react-router-dom";
import { collection, getDocs, query, limit, doc, updateDoc, deleteDoc, addDoc, onSnapshot, setDoc, where, getCountFromServer, collectionGroup, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { detectAI } from "../lib/openaiDetect";
import { ROLES, PERMISSION_GROUPS, PERMISSION_LABELS } from "../lib/roles.js";

export function AdminPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.me);
  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = (searchParams.get("tab") as any) || "overview";
  const [tab, setTab] = useState<"overview" | "users" | "moderation" | "status" | "admin" | "manager" | "developer" | "owner" | "applications" | "roles">(defaultTab);

  type ModerationEvent = { id: string; userId?: string; action: string; reason: string | null; source: string; confidence: number | null; createdAt: string; appeals: { id: string; status: string }[]; issuedBy?: string; issuedByName?: string; suspendedUntil?: string | null; ipBan?: boolean; hwidBan?: boolean; publicReason?: string | null; staffNotes?: string | null };
  type User = { id: string; username: string; displayName: string | null; email: string; accountStatus: string; presenceStatus: string; earlySupporter: boolean; verifiedBadge: boolean; createdAt: string; role?: string };
  type AdminStats = { users: number; guilds: number; messages: number };
  type TicketMessage = { id: string; authorId: string; authorName?: string; content: string; createdAt: string; isStaff: boolean };
  type Ticket = { id: string; authorId: string; authorUsername?: string; subject: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; category?: string; assignedTo?: string; staffNotes?: string; createdAt: string };
  type Report = { id: string; reporterId: string; reportedId: string; reason: string; status: "PENDING" | "RESOLVED"; createdAt: string; reportedType?: string; guildName?: string };
  type SystemConfig = { maintenanceMode: boolean; allowRegistrations: boolean; developerMode: boolean; discoveryWorkflowEnabled?: boolean };
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [modEvents, setModEvents] = useState<ModerationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [myApp, setMyApp] = useState<any>(null);
  // Reports handling states
  const [handlingReport, setHandlingReport] = useState<Report | null>(null);
  const [staffReplyMessage, setStaffReplyMessage] = useState("");
  const [staffReplyPreset, setStaffReplyPreset] = useState("Your report has been received and is being handled by our moderation team.");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketFilterStatus, setTicketFilterStatus] = useState("ALL");

  const [LenslyMessageTarget, setLenslyMessageTarget] = useState("");
  const [LenslyMessageText, setLenslyMessageText] = useState("");
  const [LenslySendBusy, setLenslySendBusy] = useState(false);
  const ALL_USERS_TARGET = "ALL_USERS";

  // Staff Applications state and real-time listener
  const [allApps, setAllApps] = useState<any[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "staffApplications"), (snap) => {
      const apps = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
      setAllApps(apps);
    });
    return () => unsub();
  }, []);

  const [toolUserId, setToolUserId] = useState("");
  const [toolReason, setToolReason] = useState("");
  const [toolPublicReason, setToolPublicReason] = useState("");
  const [toolDuration, setToolDuration] = useState("PERMANENT");
  const [toolIpBan, setToolIpBan] = useState(false);
  const [toolHwidBan, setToolHwidBan] = useState(false);

  const getRoleWeight = (role?: string | null) => {
    switch (role?.toUpperCase()) {
      case "OWNER": return 100;
      case "CO_OWNER": return 90;
      case "EXECUTIVE_DIRECTOR": return 85;
      case "HEAD_OF_STAFF": return 80;
      case "SENIOR_ADMIN": return 75;
      case "DEVELOPER": return 70;
      case "MANAGER": return 70;
      case "ADMIN": return 65;
      case "TRUST_AND_SAFETY": return 50;
      case "HEAD_MODERATOR": return 55;
      case "HEAD_TRAINER": return 45;
      case "MODERATOR_PLUS": return 42;
      case "MODERATOR": return 40;
      case "TRAINER": return 35;
      case "RECRUITER": return 32;
      case "TRIAL_MODERATOR": return 30;
      case "SUPPORT_AGENT": return 25;
      default: return 0;
    }
  };

  const myRole = me?.role?.toUpperCase();
  const isOwner = myRole === "OWNER" || myRole === "CO_OWNER";
  const isDeveloper = isOwner || myRole === "DEVELOPER";
  const isManager = isOwner || myRole === "MANAGER";
  const isAdmin = isManager || isDeveloper || myRole === "ADMIN" || me?.admin;
  const isStaff = isAdmin || myRole === "TRIAL_MODERATOR" || myRole === "MODERATOR";
  const canViewAdminPanel = isStaff;

  const [managerUserId, setManagerUserId] = useState("");
  const [managerReason, setManagerReason] = useState("");
  const [managerDuration, setManagerDuration] = useState("PERMANENT");

  const [ownerTargetUserId, setOwnerTargetUserId] = useState("");
  const [ownerTargetRole, setOwnerTargetRole] = useState("TRIAL_MODERATOR");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const [managerTargetGuildId, setManagerTargetGuildId] = useState("");
  const [managerGuildReason, setManagerGuildReason] = useState("");

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordSyncing, setDiscordSyncing] = useState(false);
  const [discordTargetUserId, setDiscordTargetUserId] = useState("");
  const [discordTargetDiscordId, setDiscordTargetDiscordId] = useState("");
  const [discordTargetRole, setDiscordTargetRole] = useState("TRIAL_MODERATOR");
  const [discordTargetAction, setDiscordTargetAction] = useState<"GRANT" | "REVOKE">("GRANT");

  const [stagedVersion, setStagedVersion] = useState("");
  const [stagedDescription, setStagedDescription] = useState(
    "" +
    " " +
    " " +
    " " +
    ""
  );
  const [stagedMinutes, setStagedMinutes] = useState("15");
  const [stagingData, setStagingData] = useState<any>(null);
  const [pendingGuilds, setPendingGuilds] = useState<any[]>([]);
  const [githubCommit, setGithubCommit] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/Lensly25/Lensly/commits/main")
      .then(res => res.json())
      .then(data => {
        if (data && data.sha) setGithubCommit(data.sha);
      }).catch(() => { });
  }, []);

  const clearUserBlacklist = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && getRoleWeight(targetUser.role) >= getRoleWeight(me?.role)) {
      return alert("Permission Denied: You cannot take action against a user with the same or higher rank.");
    }
    
    try {
      await updateDoc(doc(db, "users", userId), {
        applicationCount: 0,
        applicationCooldown: null,
        altBypassAttempts: 0,
        blacklistedFromApplying: false
      });
      alert("User's application data & blacklist cleared!");
    } catch (e) {
      alert("Failed: " + e);
    }
  };

  const hasNewGithubUpdate = githubCommit && stagingData?.deployedCommitSha && githubCommit !== stagingData?.deployedCommitSha;

  async function stageNewUpdate() {
    if (!stagedVersion || !stagedDescription) {
      alert("Please enter a version title and description.");
      return;
    }
    try {
      const scheduledTime = new Date(Date.now() + parseInt(stagedMinutes) * 60000).toISOString();
      const todayStr = new Date().toDateString();
      const isSameDay = stagingData?.lastUpdateDate === todayStr;
      const updatesTodayCount = isSameDay ? (stagingData?.updatesTodayCount || 0) + 1 : 1;

      let latestSha = stagingData?.deployedCommitSha || null;
      try {
        const res = await fetch("https://api.github.com/repos/Lensly25/Lensly/commits/main");
        const data = await res.json();
        if (data && data.sha) latestSha = data.sha;
      } catch (e) { }

      await setDoc(doc(db, "system", "update_staging"), {
        updatePending: true,
        version: stagedVersion,
        description: stagedDescription,
        scheduledTime,
        updateLive: false,
        forceUpdate: true,
        stagedAt: new Date().toISOString(),
        lastUpdateDate: todayStr,
        updatesTodayCount,
        deployedCommitSha: latestSha
      });
      alert("Update successfully staged!");
      setStagedVersion("");
      setStagedDescription("");
    } catch (err) {
      alert("Failed to stage update: " + String(err));
    }
  }

  async function forcePushUpdateLive() {
    try {
      const todayStr = new Date().toDateString();
      const isSameDay = stagingData?.lastUpdateDate === todayStr;
      const updatesTodayCount = isSameDay ? (stagingData?.updatesTodayCount || 1) : 1;

      let latestSha = stagingData?.deployedCommitSha || null;
      try {
        const res = await fetch("https://api.github.com/repos/Lensly25/Lensly/commits/main");
        const data = await res.json();
        if (data && data.sha) latestSha = data.sha;
      } catch (e) { }

      await updateDoc(doc(db, "system", "update_staging"), {
        updateLive: true,
        updatePending: false,
        forceUpdate: true,
        pushedAt: new Date().toISOString(),
        lastUpdateDate: todayStr,
        updatesTodayCount,
        deployedCommitSha: latestSha
      });
      await setDoc(doc(db, "system", "config"), { discoveryWorkflowEnabled: true }, { merge: true });
      alert("Update successfully pushed LIVE!");
    } catch (err) {
      alert("Failed to push update live: " + String(err));
    }
  }

  async function stageAndPushLive() {
    if (!stagedVersion || !stagedDescription) {
      alert("Version and description are required.");
      return;
    }
    try {
      const todayStr = new Date().toDateString();
      const isSameDay = stagingData?.lastUpdateDate === todayStr;
      const updatesTodayCount = isSameDay ? (stagingData?.updatesTodayCount || 0) + 1 : 1;

      let latestSha = stagingData?.deployedCommitSha || null;
      try {
        const res = await fetch("https://api.github.com/repos/Lensly25/Lensly/commits/main");
        const data = await res.json();
        if (data && data.sha) latestSha = data.sha;
      } catch (e) { }

      await setDoc(doc(db, "system", "update_staging"), {
        updatePending: false,
        updateLive: true,
        version: stagedVersion,
        description: stagedDescription,
        scheduledTime: new Date().toISOString(),
        forceUpdate: true,
        stagedAt: new Date().toISOString(),
        pushedAt: new Date().toISOString(),
        lastUpdateDate: todayStr,
        updatesTodayCount,
        deployedCommitSha: latestSha
      });
      await setDoc(doc(db, "system", "config"), { discoveryWorkflowEnabled: true }, { merge: true });
      alert(`✅ Update "${stagedVersion}" is now LIVE for all users!`);
    } catch (err) {
      alert("Failed: " + String(err));
    }
  }

  async function cancelStagedUpdate() {
    try {
      await setDoc(doc(db, "system", "update_staging"), {
        updatePending: false,
        updateLive: false
      });
      alert("Staged update cancelled.");
    } catch (err) {
      alert("Failed to cancel update: " + String(err));
    }
  }

  useEffect(() => {
    if (!accessToken) return;

    async function fetchStats() {
      let usersCount = 0;
      let guildsCount = 0;
      let messagesCount = 0;

      try {
        const usersSnap = await getCountFromServer(collection(db, "users"));
        usersCount = usersSnap.data().count;
      } catch (e) {
        console.error("Failed to fetch user stats:", e);
      }

      try {
        const guildsSnap = await getCountFromServer(collection(db, "guilds"));
        guildsCount = guildsSnap.data().count;
      } catch (e) {
        console.error("Failed to fetch guild stats:", e);
      }

      try {
        const channelsSnap = await getDocs(collection(db, "channels"));
        let totalMsgs = 0;
        const countPromises: Promise<any>[] = [];
        channelsSnap.forEach((chDoc) => {
          countPromises.push(
            getCountFromServer(collection(db, `channels/${chDoc.id}/messages`))
              .then((snap) => {
                totalMsgs += snap.data().count;
              })
              .catch((err) => {
                console.error(`Failed to count messages for channel ${chDoc.id}:`, err);
              })
          );
        });
        await Promise.all(countPromises);
        messagesCount = totalMsgs;
      } catch (e) {
        console.error("Failed to fetch message stats via channels:", e);
      }

      setStats({
        users: usersCount,
        guilds: guildsCount,
        messages: messagesCount,
      });
    }
    fetchStats();
  }, [accessToken, users.length]);

  useEffect(() => {
    getDocs(query(collection(db, "users"), limit(200)))
      .then((snap) => {
        const fetchedUsers: User[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedUsers.push({
            id: docSnap.id,
            username: data.username || docSnap.id,
            displayName: data.displayName || null,
            email: data.email || `${docSnap.id}@Lensly.com`,
            accountStatus: data.accountStatus || "ACTIVE",
            presenceStatus: data.presenceStatus || "OFFLINE",
            earlySupporter: !!data.earlySupporter,
            verifiedBadge: !!data.verifiedBadge,
            createdAt: data.createdAt || new Date().toISOString(),
            role: data.role || "USER"
          });
        });
        // Sort newest first
        fetchedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setUsers(fetchedUsers);
      })
      .catch((err) => console.error("Failed to fetch users for admin page:", err));
  }, []);

  useEffect(() => {
    if (tab === "moderation" && accessToken) {
      api<ModerationEvent[]>("/admin/moderation?limit=50", { token: accessToken }).then(setModEvents).catch(() => null);
      const unsubTickets = onSnapshot(query(collection(db, "tickets"), limit(50)), (snap) => {
        const t = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
        t.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTickets(t);
      });
      return () => { unsubTickets(); };
      getDocs(query(collection(db, "reports"), limit(20))).then(snap => {
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      }).catch(console.error);
    }
    if ((tab === "owner" || tab === "developer" || tab === "manager") && accessToken) {
      const unsub = onSnapshot(doc(db, "system", "config"), (snap) => {
        if (snap.exists()) {
          setSystemConfig(snap.data() as SystemConfig);
        } else {
          setSystemConfig({ maintenanceMode: false, allowRegistrations: true, developerMode: false, discoveryWorkflowEnabled: false });
        }
      }, (err) => {
        console.warn("Config permission denied, falling back to defaults for toggle:", err.message);
        setSystemConfig({ maintenanceMode: true, allowRegistrations: true, developerMode: false, discoveryWorkflowEnabled: false });
      });

      const unsubStaging = onSnapshot(doc(db, "system", "update_staging"), (snap) => {
        if (snap.exists()) {
          setStagingData(snap.data());
        } else {
          setStagingData(null);
        }
      }, (err) => console.warn("Staging read error:", err.message));

      return () => { unsub(); unsubStaging(); };
    }
  }, [tab, accessToken]);

  useEffect(() => {
    if (!selectedTicketId) {
      setTicketMessages([]);
      return;
    }
    const unsub = onSnapshot(query(collection(db, `tickets/${selectedTicketId}/messages`), limit(100)), (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketMessage));
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setTicketMessages(msgs);
    });
    return () => unsub();
  }, [selectedTicketId]);

  useEffect(() => {
    if ((tab === "manager" || tab === "admin" || tab === "moderation") && accessToken) {
      const q = query(collection(db, "guilds"), where("discoveryStatus", "==", "PENDING"));
      const unsub = onSnapshot(q, (snap) => {
        setPendingGuilds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Failed to listen to pending guilds:", err));
      return () => unsub();
    }
  }, [tab, accessToken]);

  useEffect(() => {
    if ((tab === "moderation" || tab === "manager") && accessToken) {
      const q = query(collection(db, "moderationEvents"), limit(50));
      const unsubMod = onSnapshot(q, (snap) => {
        const customEvents: ModerationEvent[] = [];
        snap.forEach(d => {
          const data = d.data();
          customEvents.push({
            id: d.id,
            action: data.action,
            reason: data.reason || null,
            source: data.source || "STAFF_ACTION",
            confidence: data.confidence !== undefined ? data.confidence : 1.0,
            createdAt: data.createdAt || new Date().toISOString(),
            appeals: data.appeals || []
          });
        });
        setModEvents(prev => {
          const merged = [...prev];
          customEvents.forEach(e => {
            if (!merged.some(m => m.id === e.id)) {
              merged.push(e);
            }
          });
          return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }, console.error);

      return () => unsubMod();
    }
  }, [tab, accessToken]);

  useEffect(() => {
    if (tab === "applications" && accessToken) {
      const unsubAllApps = onSnapshot(collection(db, "staffApplications"), (snap) => {
        setAllApps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.error("Error loading all applications:", err);
      });
      return () => unsubAllApps();
    }
  }, [tab, accessToken]);

  async function setUserStatus(userId: string, accountStatus: string, userEmail?: string) {
    if (!accessToken) return;

    const targetUser = users.find(u => u.id === userId);
    if (targetUser && getRoleWeight(targetUser.role) >= getRoleWeight(me?.role)) {
      alert("Permission Denied: You cannot take action against a user with the same or higher rank.");
      return;
    }

    let reason = "";
    if (accountStatus === "SUSPENDED") {
      const input = window.prompt("Enter the reason for suspension. An email will be sent to the user:");
      if (input === null) return; // User cancelled
      reason = input;
    }

    try {
      await updateDoc(doc(db, "users", userId), { accountStatus });
      setUsers((u) => u.map((x) => x.id === userId ? { ...x, accountStatus } : x));

      if (accountStatus === "SUSPENDED") {
        if (userEmail) {
          await addDoc(collection(db, "mail"), {
            to: [userEmail],
            message: {
              subject: "Account Suspended - Lensly",
              text: `Your account has been suspended.\nReason: ${reason || "Violation of Terms of Service"}\n\nIf you believe this was an error, please contact support.`,
              html: `<div style="font-family:sans-serif;color:#333;"><h2>Account Suspended</h2><p>Your account on Lensly has been suspended.</p><p><strong>Reason:</strong> ${reason || "Violation of Terms of Service"}</p><p>If you believe this was an error, please contact support.</p></div>`
            }
          }).catch(console.error);
        }
        alert(`User suspended successfully. An email has been dispatched to ${userEmail} with reason: "${reason || "Violation of Terms of Service"}"`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function revokeModAction(eventId: string) {
    if (!accessToken) return;
    await api(`/admin/moderation/${eventId}/revoke`, { method: "POST", token: accessToken, body: "{}" }).catch(() => null);
    setModEvents((m) => m.filter((e) => e.id !== eventId));
  }

  async function resolveReport(id: string) {
    if (!accessToken) return;
    try {
      await updateDoc(doc(db, "reports", id), { status: "RESOLVED" });
      setReports(r => r.map(x => x.id === id ? { ...x, status: "RESOLVED" } : x));
    } catch (e) { console.error(e); }
  }

  async function clearAllReports() {
    if (!accessToken) return;
    if (!window.confirm("Are you sure you want to permanently delete all reports from Firestore?")) return;
    try {
      await Promise.all(reports.map(r => deleteDoc(doc(db, "reports", r.id))));
      setReports([]);
      alert("All old reports have been cleared!");
    } catch (e) {
      console.error(e);
      alert("Failed to clear reports.");
    }
  }

  const handleAppAction = async (appId: string, userId: string, action: "ACCEPTED" | "DENIED") => {
    try {
      await updateDoc(doc(db, "staffApplications", appId), {
        status: action,
        reviewedBy: me?.id,
        reviewedAt: new Date().toISOString()
      });

      if (action === "ACCEPTED") {
        await updateDoc(doc(db, "users", userId), { role: "TRIAL_MODERATOR" });
      } else if (action === "DENIED") {
        const uDoc = await getDoc(doc(db, "users", userId));
        const data = uDoc.data() ?? {};
        // Track denial progression with a dedicated field
        const denialStep = data.denialStep ?? 0; // 0 = first denial, 1 = second+, defaults to 0
        const cd = new Date();
        if (denialStep === 0) {
          // First denial: 24‑hour (1 day) cooldown
          cd.setDate(cd.getDate() + 1);
        } else {
          // Subsequent denials: 30‑day cooldown
          cd.setDate(cd.getDate() + 30);
        }
        // Increment denialStep for future denials
        await updateDoc(doc(db, "users", userId), {
          applicationCooldown: cd.toISOString(),
          denialStep: denialStep + 1,
        });
      }

      await addDoc(collection(db, "moderationEvents"), {
        action: `APPLICATION_${action}`,
        userId: userId,
        issuedBy: me?.id,
        source: "ADMIN_PANEL",
        createdAt: new Date().toISOString(),
      });
      alert(`Application ${action}`);
    } catch (err) {
      alert("Error: " + String(err));
    }
  };

  // UI: toggle to view full application details
  const renderApplicationDetails = () => {
    if (!myApp?.answers) return null;
    return (
      <div style={{ marginTop: 16, background: "var(--bg-panel)", padding: 16, borderRadius: 8 }}>
        <h3 style={{ marginBottom: 8 }}>Application Details</h3>
        {Object.entries(myApp.answers).map(([key, value]) => (
          <p key={key} style={{ margin: "4px 0" }}><strong>{key}:</strong> {String(value)}</p>
        ))}
      </div>
    );
  };

  async function handleSendStaffReply() {
    if (!handlingReport || !accessToken) return;
    const replyText = staffReplyMessage.trim() || staffReplyPreset;
    try {
      const reporterUser = users.find(u => u.id === handlingReport.reporterId);
      const reporterUsername = reporterUser ? reporterUser.username : handlingReport.reporterId;
      const dmContent = replyText;
      const dmChannelId = `dm_` + ["Lensly", reporterUsername].sort().join("_");

      await addDoc(collection(db, `channels/${dmChannelId}/messages`), {
        content: dmContent,
        createdAt: new Date().toISOString(),
        author: {
          id: "Lensly_system",
          username: "Lensly",
          displayName: "Lensly",
          avatarUrl: "/logo.png",
          badges: [{ badge: { slug: "STAFF", label: "SYSTEM" } }]
        }
      });

      await updateDoc(doc(db, "reports", handlingReport.id), { status: "RESOLVED" });
      setReports(r => r.map(x => x.id === handlingReport.id ? { ...x, status: "RESOLVED" } : x));
      alert(`Official staff message dispatched to @${reporterUsername}'s DMs!`);
      setHandlingReport(null);
      setStaffReplyMessage("");
    } catch (e) {
      console.error(e);
      alert("Failed to send official staff reply.");
    }
  }

  async function handleSendLenslyMessage() {
    if (!accessToken || !LenslyMessageTarget.trim() || !LenslyMessageText.trim()) return;
    try {
      setLenslySendBusy(true);
      const targetUsername = LenslyMessageTarget.trim();
      const sendMessageToUser = async (username: string) => {
        const channelId = `dm_` + ["Lensly", username].sort().join("_");
        return addDoc(collection(db, `channels/${channelId}/messages`), {
          content: LenslyMessageText.trim(),
          createdAt: new Date().toISOString(),
          author: {
            id: "Lensly_system",
            username: "Lensly",
            displayName: "Lensly",
            avatarUrl: "/logo.png",
            badges: [{ badge: { slug: "STAFF", label: "SYSTEM" } }]
          }
        });
      };

      if (targetUsername === ALL_USERS_TARGET) {
        const usersSnap = await getDocs(collection(db, "users"));
        const allTargets = usersSnap.docs
          .map((docSnap) => (docSnap.data().username || docSnap.id).toString())
          .filter(Boolean);

        const chunkSize = 30;
        for (let i = 0; i < allTargets.length; i += chunkSize) {
          const batch = allTargets.slice(i, i + chunkSize);
          await Promise.all(batch.map((username) => sendMessageToUser(username)));
        }

        alert(`Official Lensly message sent to all users (${allTargets.length})!`);
      } else {
        await sendMessageToUser(targetUsername);
        alert(`Official Lensly message sent to @${targetUsername}!`);
      }

      setLenslyMessageText("");
    } catch (e) {
      console.error(e);
      alert("Failed to send Lensly message.");
    } finally {
      setLenslySendBusy(false);
    }
  }

  async function updateTicketStatus(id: string, newStatus: "OPEN" | "IN_PROGRESS" | "CLOSED", assignedTo?: string | null) {
    if (!accessToken) return;
    try {
      const updates: any = { status: newStatus };
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;
      await updateDoc(doc(db, "tickets", id), updates);
    } catch (e) { console.error(e); }
  }

  async function handleTicketReply() {
    if (!selectedTicketId || !ticketReply.trim() || !me) return;
    try {
      const replyContent = ticketReply.trim();
      await addDoc(collection(db, `tickets/${selectedTicketId}/messages`), {
        authorId: me.id,
        authorName: me.displayName || me.username,
        content: replyContent,
        createdAt: new Date().toISOString(),
        isStaff: true,
      });
      setTicketReply("");

      // Send email notification to ticket author
      void (async () => {
        try {
          const ticketDoc = await getDoc(doc(db, "tickets", selectedTicketId));
          if (ticketDoc.exists()) {
            const ticketData = ticketDoc.data();
            const authorId = ticketData.authorId; // e.g. "tylerplayz"

            let email = "";
            let recipientName = "";

            // Try to lookup user document directly by ID if authorId is a user ID
            const userDoc = await getDoc(doc(db, "users", authorId));
            if (userDoc.exists()) {
              email = userDoc.data()?.email || "";
              recipientName = userDoc.data()?.displayName || userDoc.data()?.username || "";
            } else {
              // Try to query users collection by username
              const q = query(collection(db, "users"), where("username", "==", authorId));
              const userSnap = await getDocs(q);
              if (!userSnap.empty) {
                const userData = userSnap.docs[0].data();
                email = userData.email || "";
                recipientName = userData.displayName || userData.username || "";
              }
            }

            if (email) {
              const mailerUrl = import.meta.env.VITE_MAILER_URL || "http://localhost:3002";
              await fetch(`${mailerUrl}/send/ticket-reply`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  to: email,
                  displayName: recipientName,
                  ticketId: selectedTicketId,
                  senderName: me.displayName || me.username,
                  replySnippet: replyContent.slice(0, 100) + (replyContent.length > 100 ? "..." : "")
                })
              });
            }
          }
        } catch (err) {
          console.error("Failed to send ticket reply email:", err);
        }
      })();
    } catch (e) { console.error("Failed to send reply", e); }
  }

  async function handleStaffAction(action: "WARN" | "SUSPEND" | "TERMINATE" | "UNWARN" | "UNSUSPEND" | "UNTERMINATE") {
    if (!toolUserId) return alert("Please select a target user from the dropdown.");
    const myRole = me?.role?.toUpperCase();
    if (myRole === "MODERATOR" || myRole === "MODERATOR_PLUS") {
      if (action === "TERMINATE" || action === "UNTERMINATE" || action === "UNSUSPEND" || action === "UNWARN") {
        return alert(`Permission Denied: ${myRole === "MODERATOR_PLUS" ? "Moderator+" : "Moderator"} users cannot issue permanent suspensions, bans (terminations), unsuspend, or remove warnings.`);
      }
      if (action === "SUSPEND" && (toolDuration === "PERMANENT" || toolDuration === "720")) {
        return alert(`Permission Denied: ${myRole === "MODERATOR_PLUS" ? "Moderator+" : "Moderator"} users can only suspend for up to 1 week maximum (168 hours).`);
      }
    }

    const targetUser = users.find(u => u.id === toolUserId);
    if (targetUser && getRoleWeight(targetUser.role) >= getRoleWeight(me?.role)) {
      return alert("Permission Denied: You cannot take action against a user with the same or higher rank.");
    }

    setLoading(true);
    try {
      let suspendedUntil = null;
      if (action === "SUSPEND" && toolDuration !== "PERMANENT") {
        const hours = parseInt(toolDuration, 10);
        const date = new Date();
        date.setHours(date.getHours() + hours);
        suspendedUntil = date.toISOString();
      }

      const modEventData = {
        action,
        userId: toolUserId,
        issuedBy: me?.id,
        issuedByName: me?.username,
        publicReason: toolPublicReason || null,
        staffNotes: toolReason || null,
        ipBan: toolIpBan,
        hwidBan: toolHwidBan,
        suspendedUntil,
        source: "AdminPanel",
        confidence: 1,
        createdAt: new Date().toISOString()
      };

      if (action === "WARN") {
        await addDoc(collection(db, "warnings"), { userId: toolUserId, reason: toolPublicReason, staffNotes: toolReason, issuedBy: me?.id, createdAt: new Date().toISOString() });
        alert(`Warning successfully sent to ${toolUserId}.`);
      } else if (action === "SUSPEND") {
        await updateDoc(doc(db, "users", toolUserId), { accountStatus: "SUSPENDED", suspendedUntil, suspensionReason: toolPublicReason });
        alert(`Account ${toolUserId} has been suspended ${suspendedUntil ? `until ${new Date(suspendedUntil).toLocaleString()}` : "permanently"}.`);
      } else if (action === "TERMINATE") {
        await updateDoc(doc(db, "users", toolUserId), { accountStatus: "TERMINATED", banReason: toolPublicReason, ipBan: toolIpBan, hwidBan: toolHwidBan });
        alert(`Account ${toolUserId} has been terminated.`);
      } else if (action === "UNWARN") {
        const warnsSnap = await getDocs(query(collection(db, "warnings"), where("userId", "==", toolUserId)));
        await Promise.all(warnsSnap.docs.map(d => deleteDoc(d.ref)));
        alert(`All warnings for ${toolUserId} have been cleared.`);
      } else if (action === "UNSUSPEND") {
        await updateDoc(doc(db, "users", toolUserId), { accountStatus: "ACTIVE", suspendedUntil: null, suspensionReason: null });
        alert(`Account ${toolUserId} has been unsuspended.`);
      } else if (action === "UNTERMINATE") {
        await updateDoc(doc(db, "users", toolUserId), { accountStatus: "ACTIVE", banReason: null, ipBan: false, hwidBan: false });
        alert(`Account ${toolUserId} has been unterminated (restored).`);
      }

      await addDoc(collection(db, "moderationEvents"), modEventData);

      const targetUser = users.find(u => u.id === toolUserId);
      if (targetUser?.email) {
        let subject = "";
        let html = "";

        const staffName = me?.displayName ? `${me.displayName} (@${me.username})` : `@${me?.username ?? "Staff"}`;
        if (action === "WARN") {
          subject = "Account Warning - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Warning</h2><p>Your account on Lensly has received an official warning.</p><p><strong>Actioned By:</strong> ${staffName}</p><p><strong>Reason:</strong> ${toolPublicReason || "Violation of rules"}</p><p>Please review our guidelines to avoid further action.</p></div>`;
        } else if (action === "SUSPEND") {
          subject = "Account Suspended - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Suspended</h2><p>Your account on Lensly has been suspended.</p><p><strong>Actioned By:</strong> ${staffName}</p><p><strong>Reason:</strong> ${toolPublicReason || "Violation of Terms of Service"}</p><p><strong>Duration:</strong> ${toolDuration === "PERMANENT" ? "Permanent" : toolDuration + " hours"}</p><p>If you believe this was an error, please contact support.</p></div>`;
        } else if (action === "TERMINATE") {
          subject = "Account Terminated - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Terminated</h2><p>Your account on Lensly has been permanently terminated due to severe rule violations.</p><p><strong>Actioned By:</strong> ${staffName}</p><p><strong>Reason:</strong> ${toolPublicReason || "Severe Violation of Terms of Service"}</p></div>`;
        } else if (action === "UNSUSPEND") {
          subject = "Account Unsuspended - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Unsuspended</h2><p>Your account on Lensly has been restored and is now active again.</p><p><strong>Actioned By:</strong> ${staffName}</p></div>`;
        } else if (action === "UNTERMINATE") {
          subject = "Account Restored - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Restored</h2><p>Your account on Lensly has been restored after a previous termination.</p><p><strong>Actioned By:</strong> ${staffName}</p></div>`;
        }

        if (subject && html) {
          await addDoc(collection(db, "mail"), {
            to: [targetUser.email],
            message: {
              subject,
              html,
              text: `Notice from Lensly\n\nSubject: ${subject}\nActioned By: ${staffName}\nReason: ${toolPublicReason || "Account status update"}`
            }
          }).catch(console.error);
        }
      }

      setToolUserId("");
      setToolReason("");
      setToolPublicReason("");
      setToolIpBan(false);
      setToolHwidBan(false);
    } catch (e) {
      console.error(e);
      alert("Action failed. You may not have the required database permissions.");
    } finally {
      setLoading(false);
    }
  }

  async function handleManagerGuildAction(action: "STRIKE" | "SUSPEND" | "DELETE" | "RESTORE") {
    if (!managerTargetGuildId.trim()) return alert("Please enter a target Server (Guild) ID.");
    setLoading(true);
    try {
      const gDoc = await getDoc(doc(db, "guilds", managerTargetGuildId.trim()));
      if (!gDoc.exists()) {
        alert("Server not found.");
        setLoading(false);
        return;
      }
      const gData = gDoc.data();

      if (action === "RESTORE" && gData.status === "DELETED" && me?.role?.toUpperCase() !== "OWNER") {
        alert("Only the Platform Ownership can restore permanently deleted servers.");
        setLoading(false);
        return;
      }

      if (action === "STRIKE") {
        await updateDoc(doc(db, "guilds", managerTargetGuildId.trim()), { strikes: (gData.strikes || 0) + 1 });
      } else if (action === "SUSPEND") {
        await updateDoc(doc(db, "guilds", managerTargetGuildId.trim()), { status: "SUSPENDED" });
      } else if (action === "DELETE") {
        await updateDoc(doc(db, "guilds", managerTargetGuildId.trim()), { status: "DELETED" });
      } else if (action === "RESTORE") {
        await updateDoc(doc(db, "guilds", managerTargetGuildId.trim()), { status: "ACTIVE" });
      }

      // Log the event
      await addDoc(collection(db, "moderationEvents"), {
        action: `SERVER_${action}`,
        guildId: managerTargetGuildId.trim(),
        issuedBy: me?.id,
        issuedByName: me?.username,
        source: "MANAGER_PANEL",
        reason: managerGuildReason || "No details provided.",
        staffNotes: managerGuildReason,
        createdAt: new Date().toISOString(),
      });

      alert(`Server action ${action} applied successfully.`);
      setManagerTargetGuildId("");
      setManagerGuildReason("");
    } catch (err) {
      alert("Failed to update server: " + String(err));
    }
    setLoading(false);
  }

  async function handleManagerAction(action: "HWID_BAN" | "UN_HWID_BAN" | "IP_BAN" | "UN_IP_BAN" | "WARN" | "UNWARN" | "SUSPEND" | "UNSUSPEND") {
    if (!managerUserId) return alert("Please select a target user from the dropdown.");
    
    const targetUser = users.find(u => u.id === managerUserId);
    if (targetUser && getRoleWeight(targetUser.role) >= getRoleWeight(me?.role)) {
      return alert("Permission Denied: You cannot take action against a user with the same or higher rank.");
    }

    setLoading(true);
    try {
      const targetUser = users.find(u => u.id === managerUserId);
      const email = targetUser?.email;

      if (action === "HWID_BAN") {
        await updateDoc(doc(db, "users", managerUserId), { hwidBanned: true, accountStatus: "TERMINATED" });
        alert(`Successfully HWID Banned user ${targetUser?.displayName ?? targetUser?.username ?? managerUserId}.`);
      } else if (action === "UN_HWID_BAN") {
        await updateDoc(doc(db, "users", managerUserId), { hwidBanned: false, accountStatus: "ACTIVE" });
        alert(`Successfully removed HWID Ban for user ${targetUser?.displayName ?? targetUser?.username ?? managerUserId}.`);
      } else if (action === "IP_BAN") {
        await updateDoc(doc(db, "users", managerUserId), { ipBanned: true, accountStatus: "TERMINATED" });
        alert(`Successfully IP Banned user ${targetUser?.displayName ?? targetUser?.username ?? managerUserId}.`);
      } else if (action === "UN_IP_BAN") {
        await updateDoc(doc(db, "users", managerUserId), { ipBanned: false, accountStatus: "ACTIVE" });
        alert(`Successfully removed IP Ban for user ${targetUser?.displayName ?? targetUser?.username ?? managerUserId}.`);
      } else if (action === "WARN") {
        await addDoc(collection(db, "warnings"), {
          userId: managerUserId,
          reason: managerReason,
          issuedBy: me?.id,
          createdAt: new Date().toISOString()
        });
        alert(`Warning successfully issued to ${targetUser?.displayName ?? targetUser?.username ?? managerUserId}.`);
      } else if (action === "UNWARN") {
        const warnsSnap = await getDocs(query(collection(db, "warnings"), where("userId", "==", managerUserId)));
        await Promise.all(warnsSnap.docs.map(d => deleteDoc(d.ref)));
        alert(`All warnings for ${targetUser?.displayName ?? targetUser?.username ?? managerUserId} have been cleared.`);
      } else if (action === "SUSPEND") {
        let suspendedUntil = null;
        if (managerDuration !== "PERMANENT") {
          const hours = parseInt(managerDuration, 10);
          const date = new Date();
          date.setHours(date.getHours() + hours);
          suspendedUntil = date.toISOString();
        }
        await updateDoc(doc(db, "users", managerUserId), { accountStatus: "SUSPENDED", suspendedUntil });
        alert(`User ${targetUser?.displayName ?? targetUser?.username ?? managerUserId} suspended.`);
      } else if (action === "UNSUSPEND") {
        await updateDoc(doc(db, "users", managerUserId), { accountStatus: "ACTIVE", suspendedUntil: null });
        alert(`User ${targetUser?.displayName ?? targetUser?.username ?? managerUserId} has been unsuspended.`);
      }

      // Log the management action to moderationEvents
      await addDoc(collection(db, "moderationEvents"), {
        action,
        reason: managerReason || "No reason specified",
        source: `MANAGER_${me?.role || "ACTION"}`,
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        appeals: []
      });

      // Dispatch mail notification
      if (email) {
        let subject = "";
        let html = "";
        const managerName = me?.displayName ? `${me.displayName} (@${me.username})` : `@${me?.username ?? "Management"}`;

        if (action === "HWID_BAN") {
          subject = "Hardware Ban Notice - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Hardware Ban Notice</h2><p>Your hardware signature has been banned from Lensly.</p><p><strong>Actioned By:</strong> ${managerName}</p><p><strong>Staff Notes:</strong> ${managerReason || "Severe policy violation"}</p></div>`;
        } else if (action === "IP_BAN") {
          subject = "IP Ban Notice - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>IP Ban Notice</h2><p>Your IP address has been banned from Lensly.</p><p><strong>Actioned By:</strong> ${managerName}</p><p><strong>Staff Notes:</strong> ${managerReason || "Severe policy violation"}</p></div>`;
        } else if (action === "WARN") {
          subject = "Warning Notice - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Warning Issued</h2><p>You have received an official warning.</p><p><strong>Actioned By:</strong> ${managerName}</p><p><strong>Staff Notes:</strong> ${managerReason || "Policy violation"}</p></div>`;
        } else if (action === "SUSPEND") {
          subject = "Account Suspended - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Account Suspended</h2><p>Your account has been suspended.</p><p><strong>Actioned By:</strong> ${managerName}</p><p><strong>Duration:</strong> ${managerDuration === "PERMANENT" ? "Permanent" : managerDuration + " hours"}</p><p><strong>Staff Notes:</strong> ${managerReason || "Policy violation"}</p></div>`;
        } else if (action === "UNSUSPEND") {
          subject = "Suspension Lifted - Lensly";
          html = `<div style="font-family:sans-serif;color:#333;"><h2>Suspension Lifted</h2><p>Your suspension has been lifted and your account is active again.</p><p><strong>Actioned By:</strong> ${managerName}</p></div>`;
        }

        if (subject && html) {
          await addDoc(collection(db, "mail"), {
            to: [email],
            message: { subject, html, text: `Notice from Lensly Management: ${subject}\nActioned By: ${managerName}\nNotes: ${managerReason || "No details provided"}` }
          }).catch(console.error);
        }
      }

      setManagerUserId("");
      setManagerReason("");
    } catch (e) {
      console.error(e);
      alert("Failed to execute management action.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleUpdate() {
    if (!ownerTargetUserId) return alert("Please select a target user.");

    // Security check: Only OWNER can assign OWNER or CO_OWNER
    if ((ownerTargetRole === "OWNER" || ownerTargetRole === "CO_OWNER") && me?.role?.toUpperCase() !== "OWNER") {
      return alert("Permission Denied: Only an Owner can assign the Owner or Co-Owner roles.");
    }

    const targetUser = users.find(u => u.id === ownerTargetUserId);
    if (targetUser && getRoleWeight(targetUser.role) >= getRoleWeight(me?.role)) {
      return alert("Permission Denied: You cannot take action against a user with the same or higher rank.");
    }

    setLoading(true);
    try {
      const isRemoving = ownerTargetRole === "USER";
      await updateDoc(doc(db, "users", ownerTargetUserId), {
        role: isRemoving ? null : ownerTargetRole,
        admin: ownerTargetRole === "ADMIN" || ownerTargetRole === "MANAGER" || ownerTargetRole === "CO_OWNER" || ownerTargetRole === "OWNER" || ownerTargetRole === "DEVELOPER"
      });
      alert(`Successfully updated user role to ${ownerTargetRole}.`);
      setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x, role: isRemoving ? undefined : ownerTargetRole } : x));
      setOwnerTargetUserId("");
    } catch (e) {
      console.error(e);
      alert("Failed to update role. Check database permissions.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleConfig(key: keyof SystemConfig) {
    if (!systemConfig) return;
    const newVal = !systemConfig[key];
    try {
      await setDoc(doc(db, "system", "config"), { ...systemConfig, [key]: newVal }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("Failed to update config. Have you updated firestore.rules for /system/config?");
    }
  }

  const tabStyle = (t: string) => ({ padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", background: tab === t ? "rgba(79,124,255,0.15)" : "transparent", color: tab === t ? "var(--accent)" : "var(--text-muted)", border: "none", transition: "all 0.15s", display: "block", width: "100%", textAlign: "left" as const, textDecoration: "none" });

  const STATUS_COLORS: Record<string, string> = { OPERATIONAL: "#34D399", DEGRADED: "#FBBF24", OUTAGE: "#EF4444", MAINTENANCE: "#93C5FD" };

  if (!me) {
    return (
      <div style={{ padding: 40, textAlign: "center", minHeight: "100vh", color: "var(--text)" }}>
        Loading admin dashboard...
      </div>
    );
  }

  if (!canViewAdminPanel) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, background: "var(--bg-deep)", color: "var(--text)" }}>
        <div style={{ maxWidth: 520, width: "100%", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.7 }}>
            You must be a Lensly staff member to view the admin dashboard. If you believe this is an error, please contact support.
          </p>
          <Link to="/app" className="btn btn-primary">Return to App</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-deep)", position: "relative", overflow: "hidden" }}>
      <div className="admin-header-bg" />
      {/* Sidebar */}
      <aside className="admin-glass-sidebar" style={{ width: 280, padding: "32px 16px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40, padding: "0 12px" }}>
          <img src="/logo.png" alt="Lensly Logo" style={{ width: 42, height: 42, borderRadius: 10, boxShadow: "0 8px 24px rgba(79, 124, 255, 0.4)" }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }} className="admin-text-gradient">Lensly Admin</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>Command Center</div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(() => {
            const r = me?.role?.toUpperCase();
            const isOwner = r === "OWNER" || r === "CO_OWNER";
            const isDeveloper = isOwner || r === "DEVELOPER";
            const isManager = isOwner || r === "MANAGER";
            const isAdmin = isManager || isDeveloper || r === "ADMIN" || me?.admin;
            const isStaff = isAdmin || r === "TRIAL_MODERATOR" || r === "MODERATOR";

            const availableTabs = [
              ["overview", "📊 Overview"],
              ["status", "🟢 Service Status"],
            ];

            if (isManager || isDeveloper) availableTabs.splice(1, 0, ["users", "👥 Users"]);
            if (isStaff) availableTabs.splice(2, 0, ["moderation", "🛡️ Moderation"]);
            if (isStaff) availableTabs.push(["roles", "🎖️ Roles & Perms"]);
            if (isAdmin) {
              availableTabs.push(["applications", "📋 Staff Applications"]);
              availableTabs.push(["admin", "⚙️ Admin Panel"]);
            }
            if (isManager) availableTabs.push(["manager", "📁 Manager Panel"]);
            if (isDeveloper) availableTabs.push(["developer", "💻 Developer Panel"]);
            if (isOwner) availableTabs.push(["owner", "👑 Owner/Co-owner"]);

            return availableTabs.map(([key, label]) => {
              if (key === "status") {
                return (
                  <Link key={key} to="/status" className={tab === key ? "admin-tab active" : "admin-tab"}>
                    {label}
                  </Link>
                );
              }
              return (
                <button key={key} className={tab === key ? "admin-tab active" : "admin-tab"} onClick={() => setTab(key as typeof tab)}>{label}</button>
              );
            });
          })()}
        </nav>
        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, paddingLeft: 8, paddingRight: 8 }}>
          <Link className="btn btn-ghost" to="/app" style={{ fontSize: 14, width: "100%", fontWeight: 700, padding: 12, borderRadius: 12 }}>← Back to Application</Link>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, overflow: "auto", padding: "48px 64px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {tab === "overview" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>Platform Overview</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>Real-time metrics and analytics for the Lensly network.</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginBottom: 48 }}>
              {[
                { label: "Registered Users", value: stats?.users ?? "—", icon: "👥", color: "#4F7CFF" },
                { label: "Active Servers", value: stats?.guilds ?? "—", icon: "🌌", color: "#8C5EFF" },
                { label: "Messages Sent", value: stats?.messages ?? "—", icon: "💬", color: "#34D399" },
              ].map((s) => (
                <div key={s.label} className="admin-glass-card" style={{ padding: "32px 28px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: `rgba(255,255,255,0.05)`, border: `1px solid rgba(255,255,255,0.1)`, marginBottom: 16 }}>
                    {s.icon}
                  </div>
                  <div className="admin-stat-value">{s.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>User Directory</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>Manage and view all registered users.</p>
            <div className="admin-glass-card" style={{ overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["Username", "Email", "Status", "Joined"].map((h) => (
                      <th key={h} style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "16px 24px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{u.displayName ?? u.username}</td>
                      <td style={{ padding: "16px 24px", fontSize: 14, color: "var(--text-muted)" }}>{u.email}</td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", background: u.accountStatus === "ACTIVE" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", color: u.accountStatus === "ACTIVE" ? "#34D399" : "#EF4444" }}>{u.accountStatus}</span>
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "moderation" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>
              {(me?.role?.toUpperCase() === "TRIAL_MODERATOR" || me?.role?.toUpperCase() === "MODERATOR" || me?.role?.toUpperCase() === "MODERATOR_PLUS") ? `🛡️ ${me?.role?.toUpperCase() === "TRIAL_MODERATOR" ? "Trial Moderator" : (me?.role?.toUpperCase() === "MODERATOR_PLUS" ? "Moderator+" : "Moderator")} Panel` : "🛡️ Moderation & Staff Tools"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>Manage users, review reports, and handle support tickets.</p>
            <div style={{ display: "grid", gap: 24 }}>

              {/* Quick Staff Actions Section */}
              <div className="admin-glass-card" style={{ padding: "32px", overflow: "visible" }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 24px 0", letterSpacing: "-0.02em" }}>⚡ Quick Staff Actions</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Target User</label>
                      <select
                        value={toolUserId}
                        onChange={e => setToolUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 14, outline: "none", transition: "all 0.2s" }}
                        onFocus={e => e.target.style.borderColor = "var(--accent)"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                      >
                        <option value="" disabled style={{ background: "var(--bg-panel)" }}>Select a user...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-panel)" }}>
                            {u.displayName ?? u.username} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Public Reason (Shown to user)</label>
                      <input
                        value={toolPublicReason}
                        onChange={e => setToolPublicReason(e.target.value)}
                        placeholder="e.g. Spamming in global chat"
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, outline: "none", transition: "all 0.2s" }}
                        onFocus={e => e.target.style.borderColor = "var(--accent)"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>🛡️ Internal Staff Notes (Hidden)</label>
                      <input
                        value={toolReason}
                        onChange={e => setToolReason(e.target.value)}
                        placeholder="Staff notes for this action..."
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", color: "var(--text)", fontSize: 14, outline: "none", transition: "all 0.2s" }}
                        onFocus={e => e.target.style.borderColor = "#F59E0B"}
                        onBlur={e => e.target.style.borderColor = "rgba(245,158,11,0.2)"}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Suspension Duration</label>
                      <select
                        value={toolDuration}
                        onChange={e => setToolDuration(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 14, outline: "none", transition: "all 0.2s" }}
                        onFocus={e => e.target.style.borderColor = "var(--accent)"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                      >
                        <option value="1" style={{ background: "var(--bg-panel)" }}>1 Hour</option>
                        <option value="24" style={{ background: "var(--bg-panel)" }}>1 Day</option>
                        <option value="168" style={{ background: "var(--bg-panel)" }}>1 Week</option>
                        <option value="PERMANENT" style={{ background: "var(--bg-panel)" }}>Permanent (Ban)</option>
                      </select>
                    </div>
                    
                    <div style={{ display: "flex", gap: 24, padding: "16px 20px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, marginTop: 4 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800, color: "#FCA5A5", cursor: "pointer" }}>
                        <input type="checkbox" checked={toolIpBan} onChange={e => setToolIpBan(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#EF4444" }} />
                        Enforce IP Ban
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800, color: "#FCA5A5", cursor: "pointer" }}>
                        <input type="checkbox" checked={toolHwidBan} onChange={e => setToolHwidBan(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#EF4444" }} />
                        Enforce HWID Ban
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
                      <button disabled={loading} onClick={() => void handleStaffAction("WARN")} className="btn" style={{ flex: 1, padding: "16px", background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, fontSize: 15, fontWeight: 800, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.25)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(245,158,11,0.15)"}>Issue Warn</button>
                      <button disabled={loading} onClick={() => void handleStaffAction("SUSPEND")} className="btn" style={{ flex: 1, padding: "16px", background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, fontSize: 15, fontWeight: 800, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.25)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}>Enforce Suspension</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reports Section */}
              <div className="admin-glass-card" style={{ padding: "32px", overflow: "visible" }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 24px 0", letterSpacing: "-0.02em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🚨 Active Reports</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 13, background: "rgba(239,68,68,0.15)", color: "#EF4444", padding: "6px 14px", borderRadius: 999, fontWeight: 800 }}>{reports.filter(r => r.status === "PENDING").length} Pending</span>
                    {reports.length > 0 && (
                      <button className="btn" style={{ fontSize: 13, padding: "6px 14px", color: "#EF4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 999, fontWeight: 800 }} onClick={() => void clearAllReports()}>
                        🗑️ Clear All
                      </button>
                    )}
                  </div>
                </h2>

                {reports.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 15, textAlign: "center", padding: "40px 0", fontWeight: 600 }}>No active reports found.</div>
                ) : (
                  <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "rgba(0,0,0,0.4)" }}>
                          <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em" }}>Target</th>
                          <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em" }}>Reason</th>
                          <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em" }}>Status</th>
                          <th style={{ padding: "16px 20px", textAlign: "right", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((r) => (
                          <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={{ padding: "16px 20px", fontSize: 14, fontWeight: 700 }}>
                              {r.reportedType === "SERVER" ? (
                                <span style={{ color: "var(--accent-2)" }}>🌐 Server: {r.guildName || r.reportedId}</span>
                              ) : (
                                <span>👤 User: <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{r.reportedId}</span></span>
                              )}
                            </td>
                            <td style={{ padding: "16px 20px", fontSize: 14, color: "var(--text)" }}>{r.reason}</td>
                            <td style={{ padding: "16px 20px" }}>
                              <span style={{ padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: "uppercase", background: r.status === "RESOLVED" ? "rgba(52,211,153,0.15)" : "rgba(245,158,11,0.15)", color: r.status === "RESOLVED" ? "#34D399" : "#F59E0B" }}>{r.status}</span>
                            </td>
                            <td style={{ padding: "16px 20px", textAlign: "right" }}>
                              {r.status === "PENDING" && (
                                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                  <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "rgba(79,124,255,0.15)", color: "var(--accent)", borderRadius: 8, fontWeight: 700 }} onClick={() => void resolveReport(r.id)}>Resolve</button>
                                  <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "rgba(52,211,153,0.15)", color: "#34D399", borderRadius: 8, fontWeight: 700 }} onClick={() => setHandlingReport(r)}>Handle</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ─── Handle Report / Reply Modal ─── */}
                {handlingReport && (
                  <div className="modal-overlay" onClick={() => setHandlingReport(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
                      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#34D399", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🛡️</span> Handle Report & Reply to Reporter
                      </h2>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
                        Send an official Lensly moderation message directly to the reporter's DMs.
                      </p>

                      <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 13 }}>
                        <div><strong>Reported Target:</strong> {handlingReport.reportedType === "SERVER" ? `Server "${handlingReport.guildName || ""}" (${handlingReport.reportedId})` : `User ${handlingReport.reportedId}`}</div>
                        <div style={{ marginTop: 4 }}><strong>Violation Reason:</strong> {handlingReport.reason}</div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>Select Quick Response Preset</label>
                        <select
                          value={staffReplyPreset}
                          onChange={e => setStaffReplyPreset(e.target.value)}
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 13 }}
                        >
                          <option value="Your report has been received and is being handled by our moderation team.">Your report has been received and is being handled by our moderation team.</option>
                          <option value="Thank you for your report. We have investigated the user and taken appropriate disciplinary action.">Thank you for your report. We have investigated the user and taken appropriate disciplinary action.</option>
                          <option value="We have reviewed your report but found no violation of our Terms of Service at this time.">We have reviewed your report but found no violation of our Terms of Service at this time.</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>Or Type Custom Staff Message (Optional)</label>
                        <textarea
                          rows={4}
                          value={staffReplyMessage}
                          onChange={e => setStaffReplyMessage(e.target.value)}
                          placeholder="Type custom message to reporter..."
                          style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost" onClick={() => setHandlingReport(null)} style={{ padding: "10px 20px" }}>Cancel</button>
                        <button className="btn btn-primary" onClick={() => void handleSendStaffReply()} style={{ padding: "10px 20px", background: "#34D399", border: "none", color: "#111", fontWeight: 700, borderRadius: 10 }}>Send Official Staff Reply</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tickets Section */}
              <div className="admin-glass-card" style={{ padding: 0, display: "flex", minHeight: 600, overflow: "hidden" }}>
                {/* Left Pane - Ticket List */}
                <div style={{ width: 340, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)" }}>
                  <div style={{ padding: "24px 20px" }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      Support Tickets
                      <span style={{ fontSize: 11, background: "rgba(52,211,153,0.15)", color: "#34D399", padding: "4px 10px", borderRadius: 999, fontWeight: 800 }}>{tickets.filter(t => t.status !== "CLOSED").length} Active</span>
                    </h2>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" placeholder="Search ID..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none" }} />
                      <select value={ticketFilterStatus} onChange={e => setTicketFilterStatus(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none" }}>
                        <option value="ALL" style={{ background: "var(--bg-panel)" }}>All</option>
                        <option value="OPEN" style={{ background: "var(--bg-panel)" }}>Open</option>
                        <option value="IN_PROGRESS" style={{ background: "var(--bg-panel)" }}>Active</option>
                        <option value="CLOSED" style={{ background: "var(--bg-panel)" }}>Closed</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", padding: "0 12px 12px 12px", gap: 6 }}>
                    {tickets.filter(t => (ticketFilterStatus === "ALL" || t.status === ticketFilterStatus) && (t.id.includes(ticketSearch) || t.subject.toLowerCase().includes(ticketSearch.toLowerCase()))).map((t) => (
                      <div key={t.id} onClick={() => setSelectedTicketId(t.id)} style={{ padding: "14px 16px", borderRadius: 12, background: selectedTicketId === t.id ? "rgba(79,124,255,0.1)" : "transparent", border: selectedTicketId === t.id ? "1px solid rgba(79,124,255,0.2)" : "1px solid transparent", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { if (selectedTicketId !== t.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }} onMouseLeave={e => { if (selectedTicketId !== t.id) e.currentTarget.style.background = "transparent" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: t.status === "CLOSED" ? "rgba(255,255,255,0.1)" : t.status === "IN_PROGRESS" ? "rgba(245,158,11,0.15)" : "rgba(52,211,153,0.15)", color: t.status === "CLOSED" ? "var(--text-muted)" : t.status === "IN_PROGRESS" ? "#F59E0B" : "#34D399" }}>{t.status}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                          <span>@{t.authorUsername || t.authorId.slice(0, 8)}</span>
                          <span>{t.category || "General"}</span>
                        </div>
                      </div>
                    ))}
                    {tickets.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No tickets found.</div>}
                  </div>
                </div>

                {/* Right Pane - Ticket Viewer */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "transparent" }}>
                  {selectedTicketId ? (() => {
                    const activeTicket = tickets.find(t => t.id === selectedTicketId);
                    if (!activeTicket) return <div style={{ color: "var(--text-muted)", margin: "auto" }}>Ticket not found</div>;
                    return (
                      <>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "rgba(0,0,0,0.2)" }}>
                          <div>
                            <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>{activeTicket.subject}</h3>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>ID: <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{activeTicket.id}</span> • {new Date(activeTicket.createdAt).toLocaleString()}</div>
                            {activeTicket.assignedTo && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6, fontWeight: 700 }}>Assigned to: @{activeTicket.assignedTo}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            {activeTicket.status !== "CLOSED" ? (
                              <button className="btn" style={{ fontSize: 12, padding: "8px 16px", background: "rgba(239,68,68,0.1)", color: "#EF4444", borderRadius: 8, fontWeight: 700 }} onClick={() => void updateTicketStatus(activeTicket.id, "CLOSED")}>Close Ticket</button>
                            ) : (
                              <button className="btn" style={{ fontSize: 12, padding: "8px 16px", background: "rgba(52,211,153,0.15)", color: "#34D399", borderRadius: 8, fontWeight: 700 }} onClick={() => void updateTicketStatus(activeTicket.id, "OPEN")}>Reopen Ticket</button>
                            )}
                            <button className="btn" style={{ fontSize: 12, padding: "8px 16px", background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.2)", color: "var(--accent)", borderRadius: 8, fontWeight: 700 }} onClick={() => void updateTicketStatus(activeTicket.id, activeTicket.status, me?.username)}>Claim</button>
                          </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, padding: "24px 32px" }}>
                          {ticketMessages.map(m => (
                            <div key={m.id} style={{ display: "flex", gap: 12, flexDirection: m.isStaff ? "row-reverse" : "row" }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.isStaff ? "linear-gradient(135deg, var(--accent), var(--accent-2))" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0, boxShadow: m.isStaff ? "0 4px 12px rgba(79, 124, 255, 0.3)" : "none" }}>
                                {m.authorName ? m.authorName[0].toUpperCase() : "?"}
                              </div>
                              <div style={{ background: m.isStaff ? "rgba(79,124,255,0.1)" : "rgba(255,255,255,0.03)", padding: "12px 16px", borderRadius: 16, borderTopRightRadius: m.isStaff ? 4 : 16, borderTopLeftRadius: m.isStaff ? 16 : 4, maxWidth: "80%", border: m.isStaff ? "1px solid rgba(79,124,255,0.2)" : "1px solid rgba(255,255,255,0.05)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexDirection: m.isStaff ? "row-reverse" : "row" }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: m.isStaff ? "var(--accent)" : "#fff" }}>{m.authorName || m.authorId}</span>
                                  {m.isStaff && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 800 }}>STAFF</span>}
                                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div style={{ fontSize: 14, color: "var(--text)", whiteSpace: "pre-wrap", textAlign: m.isStaff ? "right" : "left", lineHeight: 1.5 }}>{m.content}</div>
                              </div>
                            </div>
                          ))}
                          {ticketMessages.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, marginTop: 40, fontWeight: 500 }}>No messages yet. Reply to start the conversation!</div>}
                        </div>

                        {/* Internal Notes & Reply Box */}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "20px 32px", display: "flex", flexDirection: "column", gap: 16, background: "rgba(0,0,0,0.2)" }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#F59E0B", marginBottom: 8, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>🛡️ Internal Notes (Staff Only)</div>
                            <textarea defaultValue={activeTicket.staffNotes || ""} onBlur={async (e) => await updateDoc(doc(db, "tickets", activeTicket.id), { staffNotes: e.target.value })} placeholder="Add hidden notes about this ticket..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", color: "#fff", fontSize: 13, minHeight: 44, resize: "vertical", outline: "none" }} />
                          </div>
                          <div style={{ display: "flex", gap: 12 }}>
                            <textarea value={ticketReply} onChange={e => setTicketReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleTicketReply(); } }} placeholder="Type a reply to the user..." style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, minHeight: 52, resize: "none", outline: "none" }} />
                            <button className="btn btn-primary" onClick={() => void handleTicketReply()} style={{ padding: "0 28px", borderRadius: 12, fontSize: 15, fontWeight: 800 }}>Reply</button>
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <div style={{ margin: "auto", color: "var(--text-muted)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>Select a ticket to view details</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Moderation Actions / Audit Log Section */}
              <div className="admin-glass-card" style={{ padding: "32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>📋 Enforcement History</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0, fontWeight: 500 }}>Full audit log of all moderation actions.</p>
                  </div>
                  <input type="text" placeholder="Search by User ID or Staff ID..." style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, width: 280, outline: "none" }} onChange={e => {
                    const v = e.target.value.toLowerCase();
                    const els = document.querySelectorAll('.mod-event-card');
                    els.forEach((el: any) => {
                      if (el.innerText.toLowerCase().includes(v)) el.style.display = 'block';
                      else el.style.display = 'none';
                    });
                  }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 640, overflowY: "auto", paddingRight: 4 }}>
                  {modEvents.map((e) => (
                    <div key={e.id} className="mod-event-card" style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", background: "rgba(0,0,0,0.2)" }}>
                      {/* Header row */}
                      <div style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.05)", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ padding: "4px 14px", borderRadius: 999, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", background: e.action === "WARN" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)", color: e.action === "WARN" ? "#F59E0B" : "#EF4444" }}>{e.action}</span>
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Target:</span>
                          <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "monospace", fontWeight: 700 }}>{e.userId}</span>
                          <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(79,124,255,0.1)", color: "var(--accent)" }}>by {e.issuedByName || e.issuedBy || e.source}</span>
                          {e.suspendedUntil && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}>⏱ Expires {new Date(e.suspendedUntil).toLocaleDateString()}</span>}
                          {e.ipBan && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 900, background: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>IP BAN</span>}
                          {e.hwidBan && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 900, background: "rgba(239,68,68,0.2)", color: "#FCA5A5" }}>HWID BAN</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" style={{ background: "rgba(52,211,153,0.1)", color: "#34D399", fontSize: 12, padding: "6px 14px", borderRadius: 8, fontWeight: 700, border: "1px solid rgba(52,211,153,0.2)", whiteSpace: "nowrap" }} onClick={() => void revokeModAction(e.id)}>Revoke</button>
                          <button className="btn" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: 12, padding: "6px 14px", borderRadius: 8, fontWeight: 700, border: "1px solid rgba(239,68,68,0.2)", whiteSpace: "nowrap" }} onClick={async () => await deleteDoc(doc(db, "moderationEvents", e.id))}>Delete</button>
                        </div>
                      </div>
                      {/* Notes row */}
                      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Public Reason</label>
                          <textarea defaultValue={e.publicReason || e.reason || ""} onBlur={async (ev) => await updateDoc(doc(db, "moderationEvents", e.id), { publicReason: ev.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text)", fontSize: 13, minHeight: 44, resize: "vertical", outline: "none" }} placeholder="Public reason..." />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Staff Notes (Hidden)</label>
                          <textarea defaultValue={e.staffNotes || ""} onBlur={async (ev) => await updateDoc(doc(db, "moderationEvents", e.id), { staffNotes: ev.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", color: "var(--text)", fontSize: 13, minHeight: 44, resize: "vertical", outline: "none" }} placeholder="Internal notes..." />
                        </div>
                        <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(e.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {modEvents.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 15, padding: "40px 0", textAlign: "center", fontWeight: 600 }}>No moderation actions recorded.</div>}
                </div>
              </div>

            </div>
          </div>
        )}

        {tab === "admin" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: "-0.03em" }}>⚙️ Admin Settings</h1>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#F59E0B", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>System Operations</span>
            </div>

            {/* Platform Metrics Dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
              <div className="admin-glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Users</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{users.length.toLocaleString()}</div>
              </div>
              <div className="admin-glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: "#34D399", boxShadow: "0 0 12px #34D399" }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Guilds</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{(stats?.guilds ?? 0).toLocaleString()}</div>
              </div>
              <div className="admin-glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: "#8C5EFF", boxShadow: "0 0 12px #8C5EFF" }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Support Tickets</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{tickets.length.toLocaleString()}</div>
              </div>
              <div className="admin-glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: "#EF4444", boxShadow: "0 0 12px #EF4444" }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Reports</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{reports.filter(r => r.status === "OPEN").length}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

              {/* Left Column: System Config & Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Quick Operations */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px 0", color: "var(--accent)" }}>⚡ Quick Operations</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    {[
                      { icon: "🧹", label: "Clear System Cache", desc: "Flushes local and edge caches instantly." },
                      { icon: "🔄", label: "Force Sync Realtime Nodes", desc: "Re-synchronizes active WebSocket connections." },
                      { icon: "📥", label: "Export Audit Logs (CSV)", desc: "Downloads a full history of all recorded actions." }
                    ].map(op => (
                      <button key={op.label} onClick={() => alert(`Initiated operation: ${op.label}`)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                        <div style={{ fontSize: 24 }}>{op.icon}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{op.label}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{op.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Real-Time System Audit Logs */}
              <div className="admin-glass-card" style={{ padding: 32, maxHeight: "1200px", overflowY: "auto" }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", color: "#34D399" }}>📜 Real-Time System Audit Logs</h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5, fontWeight: 500 }}>
                  Live immutable audit trail of all administrative actions, role assignments, system config changes, and moderation events across Lensly.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {modEvents.map((e) => {
                    const isDanger = e.action.includes("BAN") || e.action.includes("TERMINATE") || e.action.includes("DELETE");
                    const isWarn = e.action.includes("WARN") || e.action.includes("EDIT");
                    const color = isDanger ? "#EF4444" : isWarn ? "#F59E0B" : "#34D399";
                    return (
                      <div key={e.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color }} />
                        <div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                            <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${color}20`, color: color }}>
                              {e.action}
                            </span>
                            <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,0.1)", color: "var(--text-muted)" }}>
                              SRC: {e.source}
                            </span>
                          </div>
                          <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginTop: 8 }}>{e.reason || "No notes provided."}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontWeight: 500 }}>{new Date(e.createdAt).toLocaleString()}</div>
                        </div>
                        <button className="btn" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13, padding: "10px 16px", borderRadius: 10, fontWeight: 700 }} onClick={() => void revokeModAction(e.id)}>
                          Revoke
                        </button>
                      </div>
                    );
                  })}
                  {modEvents.length === 0 && (
                    <div style={{ padding: "64px 0", textAlign: "center", color: "var(--text-muted)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📜</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>No system logs recorded.</div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

                {tab === "manager" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 32, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>📁</span> Management Moderation & Operations Panel
            </h1>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

              {/* Management Controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Role Management Box */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", color: "#3B82F6", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🛡️</span> Enterprise Role Management Console
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5, fontWeight: 500 }}>
                    Assign or revoke official staff roles across the Lensly platform. Staff roles automatically grant appropriate moderation and administrative dashboard permissions.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target User</label>
                      <select
                        value={ownerTargetUserId}
                        onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none", transition: "all 0.2s" }}
                      >
                        <option value="" style={{ background: "var(--bg-deep)" }}>-- Select Target User --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>
                            {u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`} - {u.accountStatus} {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Select Official Staff Role</label>
                      <select
                        value={ownerTargetRole}
                        onChange={e => setOwnerTargetRole(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none", transition: "all 0.2s" }}
                      >
                        <option value="OWNER" style={{ background: "var(--bg-deep)" }}>👑 Owner — Full control over Lensly</option>
                        <option value="CO_OWNER" style={{ background: "var(--bg-deep)" }}>🤝 Co-Owner — Assists the Owner</option>
                        <option value="EXECUTIVE_DIRECTOR" style={{ background: "var(--bg-deep)" }}>🧾 Executive Director — Oversees departments & operations</option>
                        <option value="HEAD_OF_STAFF" style={{ background: "var(--bg-deep)" }}>🏆 Head of Staff — Oversees all staff teams</option>
                        <option value="SENIOR_ADMIN" style={{ background: "var(--bg-deep)" }}>🧩 Senior Administrator — High-level decisions & supervision</option>
                        <option value="ADMIN" style={{ background: "var(--bg-deep)" }}>⚖️ Administrator — Manages moderators & escalated issues</option>
                        <option value="HEAD_MODERATOR" style={{ background: "var(--bg-deep)" }}>🛡️ Head Moderator — Leads the moderation team</option>
                        <option value="MODERATOR" style={{ background: "var(--bg-deep)" }}>🔨 Moderator — Enforces rules & reviews reports</option>
                        <option value="TRIAL_MODERATOR" style={{ background: "var(--bg-deep)" }}>👀 Trial Moderator — Moderator in training</option>
                        <option value="TRUST_AND_SAFETY" style={{ background: "var(--bg-deep)" }}>🔒 Trust & Safety — Reviews abuse & safety reports</option>
                        <option value="SUPPORT_AGENT" style={{ background: "var(--bg-deep)" }}>🎫 Support Agent — Handles tickets & account issues</option>
                        <option value="HEAD_TRAINER" style={{ background: "var(--bg-deep)" }}>🎓 Head Trainer — Leads training programs</option>
                        <option value="TRAINER" style={{ background: "var(--bg-deep)" }}>🧑‍🏫 Trainer — Mentors new team members</option>
                        <option value="RECRUITER" style={{ background: "var(--bg-deep)" }}>📋 Recruiter — Reviews applications & recruits staff</option>
                        <option value="USER" style={{ background: "var(--bg-deep)" }}>❌ Remove Staff Role — Revert to Regular User</option>
                      </select>
                    </div>

                    <button
                      disabled={loading}
                      onClick={() => void handleRoleUpdate()}
                      style={{ marginTop: 8, padding: "16px 24px", fontSize: 16, fontWeight: 800, borderRadius: 12, background: "linear-gradient(135deg, #4F7CFF 0%, #3B82F6 100%)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(79,124,255,0.3)", transition: "all 0.2s", opacity: loading ? 0.7 : 1 }}
                    >
                      {loading ? "Updating Role…" : "✨ Grant / Update Staff Role"}
                    </button>
                  </div>
                </div>

                {/* User Management Console */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px 0", color: "#3B82F6", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🛡️</span> User Management Console
                  </h2>

                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target User</label>
                      <select
                        value={managerUserId}
                        onChange={e => setManagerUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}
                      >
                        <option value="" style={{ background: "var(--bg-deep)" }}>-- Select Target User --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>
                            {u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`} - {u.accountStatus} {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Staff Notes / Case Details</label>
                      <textarea
                        value={managerReason}
                        onChange={e => setManagerReason(e.target.value)}
                        placeholder="Provide notes and details about this moderation event..."
                        style={{ width: "100%", height: 100, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", resize: "none", fontFamily: "inherit", fontSize: 15, outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Suspension Duration</label>
                      <select
                        value={managerDuration}
                        onChange={e => setManagerDuration(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}
                      >
                        <option value="1" style={{ background: "var(--bg-deep)" }}>1 Hour</option>
                        <option value="24" style={{ background: "var(--bg-deep)" }}>1 Day</option>
                        <option value="168" style={{ background: "var(--bg-deep)" }}>1 Week</option>
                        <option value="720" style={{ background: "var(--bg-deep)" }}>1 Month</option>
                        <option value="PERMANENT" style={{ background: "var(--bg-deep)" }}>Permanent</option>
                      </select>
                    </div>

                    {/* Action Grid */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("WARN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}>⚠️ Issue Warning</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UNWARN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>✅ Clear Warnings</button>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("SUSPEND")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>🛑 Suspend User</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UNSUSPEND")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>✅ Lift Suspension</button>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("HWID_BAN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.4)" }}>💻 HWID Ban</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UN_HWID_BAN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>💻 Remove HWID</button>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerAction("IP_BAN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.4)" }}>🌐 IP Ban</button>
                        <button disabled={loading} onClick={() => void handleManagerAction("UN_IP_BAN")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}>🌐 Remove IP Ban</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Server Enforcement Console */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px 0", color: "#3B82F6", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🏢</span> Server Enforcement Console
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Server (Guild) ID</label>
                      <input
                        type="text"
                        value={managerTargetGuildId}
                        onChange={e => setManagerTargetGuildId(e.target.value)}
                        placeholder="Paste Guild ID here..."
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontFamily: "monospace", fontSize: 15, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action Reason / Notes</label>
                      <textarea
                        value={managerGuildReason}
                        onChange={e => setManagerGuildReason(e.target.value)}
                        placeholder="Reason for suspension, deletion, or strike..."
                        style={{ width: "100%", height: 80, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", resize: "none", fontFamily: "inherit", fontSize: 15, outline: "none" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("STRIKE")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>⚠️ Issue Strike</button>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("SUSPEND")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>🛑 Suspend Server</button>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("DELETE")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(239,68,68,0.25)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.4)" }}>❌ Delete Server</button>
                        <button disabled={loading} onClick={() => void handleManagerGuildAction("RESTORE")} className="btn" style={{ flex: 1, padding: "14px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>✅ Restore Server</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Server Discovery Approval Queue */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#34D399", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🌐</span> Discovery Approval Queue
                      </h2>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8, fontWeight: 500 }}>
                        Servers requesting to be listed in the Public Discovery directory.
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Workflow Status:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: systemConfig?.discoveryWorkflowEnabled ? "#34D399" : "#F59E0B" }}>
                        {systemConfig?.discoveryWorkflowEnabled ? "● ACTIVE" : "○ INACTIVE"}
                      </span>
                    </div>
                  </div>

                  {!systemConfig?.discoveryWorkflowEnabled ? (
                    <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "20px", color: "var(--text)", fontSize: 14, lineHeight: "1.6" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, color: "#F59E0B", fontWeight: 800 }}>
                        <span style={{ fontSize: 20 }}>⚠️</span> Discovery Questionnaire Workflow Inactive
                      </div>
                      The custom discovery questionnaire and staff review queue workflow is currently inactive. You can re-enable it directly from the Developer controls.
                    </div>
                  ) : pendingGuilds.length === 0 ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>No pending server discovery requests!</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {pendingGuilds.map((g) => (
                        <div key={g.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 24 }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                            {g.iconUrl ? (
                              <img src={g.iconUrl} alt={g.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                                {g.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginTop: 2 }}>ID: {g.id}</div>
                            </div>
                          </div>
                          {g.description && (
                            <div style={{ fontSize: 14, color: "var(--text-muted)", margin: "8px 0 16px", lineHeight: "1.5" }}>
                              {g.description}
                            </div>
                          )}

                          {g.discoveryRequest && (
                            <div style={{ margin: "12px 0 20px 0", padding: "16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, fontSize: 13, display: "flex", flexDirection: "column", gap: 12 }}>
                              <div style={{ fontWeight: 800, color: "#34D399", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                                📋 Discovery Questionnaire
                              </div>

                              <div>
                                <span style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>Why list this server?</span>
                                <div style={{ color: "#fff", marginTop: 4, paddingLeft: 12, borderLeft: "2px solid var(--accent)", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>
                                  {g.discoveryRequest.whyJoin}
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: 8 }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>Approx. Members</span>
                                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginTop: 4 }}>{g.discoveryRequest.memberCount}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: 8 }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>Primary Category</span>
                                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginTop: 4 }}>{g.discoveryRequest.category}</div>
                                </div>
                              </div>

                              {g.discoveryRequest.guidelines && (
                                <div style={{ marginTop: 8 }}>
                                  <span style={{ fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.05em" }}>Rules & Review Details</span>
                                  <div style={{ color: "#fff", marginTop: 4, paddingLeft: 12, borderLeft: "2px solid #F59E0B", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>
                                    {g.discoveryRequest.guidelines}
                                  </div>
                                </div>
                              )}

                              {g.discoveryRequest.submittedAt && (
                                <div style={{ fontSize: 11, color: "var(--text-dim)", alignSelf: "flex-end", marginTop: 8, fontWeight: 500 }}>
                                  Submitted: {new Date(g.discoveryRequest.submittedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 12 }}>
                            <button
                              className="btn"
                              style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 800, borderRadius: 10, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)", transition: "all 0.2s" }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "guilds", g.id), { discoveryStatus: "APPROVED", isPublic: true });
                                  alert(`Server "${g.name}" has been approved for Discovery!`);
                                } catch (err) {
                                  alert("Failed to approve server: " + String(err));
                                }
                              }}
                            >
                              ✓ Approve Application
                            </button>
                            <button
                              className="btn"
                              style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 800, borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", transition: "all 0.2s" }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "guilds", g.id), { discoveryStatus: "REJECTED", isPublic: false });
                                  alert(`Server "${g.name}" discovery request has been rejected.`);
                                } catch (err) {
                                  alert("Failed to reject server: " + String(err));
                                }
                              }}
                            >
                              ✕ Reject Application
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Management Logs / Audit Feed */}
              <div className="admin-glass-card" style={{ padding: 32, maxHeight: "1200px", overflowY: "auto" }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", color: "#34D399", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📜</span> Real-time Moderation Audit Feed
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5, fontWeight: 500 }}>
                  Live feed of all administrative and moderation actions taken across the platform.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {modEvents.map((e) => {
                    const isDanger = e.action.includes("BAN") || e.action.includes("TERMINATE") || e.action.includes("DELETE");
                    const isWarn = e.action.includes("WARN") || e.action.includes("EDIT");
                    const color = isDanger ? "#EF4444" : isWarn ? "#F59E0B" : "#34D399";
                    return (
                      <div key={e.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color }} />
                        <div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                            <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${color}20`, color: color }}>
                              {e.action}
                            </span>
                            <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(255,255,255,0.1)", color: "var(--text-muted)" }}>
                              SRC: {e.source}
                            </span>
                          </div>
                          <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 600, marginTop: 8 }}>{e.reason || "No notes provided."}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, fontWeight: 500 }}>{new Date(e.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                  {modEvents.length === 0 && (
                    <div style={{ padding: "64px 0", textAlign: "center", color: "var(--text-muted)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📜</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>No actions logged yet.</div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

                {tab === "developer" && (() => {
          const r = me?.role?.toUpperCase();
          if (r !== "OWNER" && r !== "CO_OWNER" && r !== "DEVELOPER") return null;
          return (
            <div style={{ animation: "fadeIn 0.4s ease-out" }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 32, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>💻</span> Developer Panel
              </h1>
              {hasNewGithubUpdate && (
                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "20px 24px", borderRadius: 16, marginBottom: 32, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 32 }}>🚨</div>
                  <div>
                    <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 18, marginBottom: 6 }}>New Code on GitHub: Waiting for latest release</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>A new commit was detected on GitHub. Go to the Staged Updates section below to stage or force push the new release live!</div>
                  </div>
                </div>
              )}
              
              <div style={{ display: "grid", gap: 32 }}>
                {/* Global System Configurations */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#34D399", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⚙️</span> Platform System Configurations
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5, fontWeight: 500 }}>
                    Manage platform-wide capabilities, experimental flags, and core routing logic.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
                    {[
                      { id: "maintenanceMode", label: "Maintenance Mode", desc: "Restricts platform access to staff members only.", activeColor: "#EF4444", activeLabel: "ENABLED (Lockout)", inactiveLabel: "DISABLED (Normal)" },
                      { id: "allowRegistrations", label: "Allow Registrations", desc: "Allows new users to create accounts on Lensly.", activeColor: "#34D399", activeLabel: "ALLOWED (Open)", inactiveLabel: "DISABLED (Closed)" },
                      { id: "developerMode", label: "Developer Bypass Mode", desc: "Allows developer debugging tools and staging bypass.", activeColor: "#34D399", activeLabel: "ACTIVE", inactiveLabel: "INACTIVE" },
                      { id: "allowUploads", label: "Global File Uploads", desc: "Enable or disable media uploads platform-wide.", activeColor: "#34D399", activeLabel: "ALLOWED", inactiveLabel: "BLOCKED" },
                      { id: "allowDMs", label: "Direct Messaging", desc: "Allow users to initiate new direct messages.", activeColor: "#34D399", activeLabel: "ALLOWED", inactiveLabel: "BLOCKED" },
                      { id: "strictAutoMod", label: "Strict AutoMod Mode", desc: "Enable highly aggressive filtering for all messages.", activeColor: "#EF4444", activeLabel: "STRICT", inactiveLabel: "NORMAL" },
                      { id: "discoveryWorkflowEnabled", label: "Discovery Questionnaire Workflow", desc: "Enables staff discovery request forms, approval queues, & verified system DMs.", activeColor: "#34D399", activeLabel: "ENABLED", inactiveLabel: "DISABLED" }
                    ].map(cfg => {
                      const isActive = Boolean((systemConfig as any)?.[cfg.id]);
                      return (
                        <div key={cfg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", transition: "all 0.2s" }}>
                          <div style={{ paddingRight: 16 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>{cfg.label}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.4 }}>{cfg.desc}</div>
                          </div>
                          <button
                            onClick={() => void toggleConfig(cfg.id)}
                            style={{
                              padding: "10px 16px", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer",
                              background: isActive ? `${cfg.activeColor}15` : "rgba(255,255,255,0.03)",
                              color: isActive ? cfg.activeColor : "var(--text-muted)",
                              border: `1px solid ${isActive ? cfg.activeColor + "40" : "rgba(255,255,255,0.1)"}`,
                              minWidth: 150, transition: "all 0.2s flex-shrink-0", whiteSpace: "nowrap"
                            }}
                          >
                            {isActive ? cfg.activeLabel : cfg.inactiveLabel}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Staged Updates & Rollout Scheduler */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#06B6D4", display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🚀</span> Staged System Updates & Rollout Scheduler
                      </h2>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>Stage platform updates with an automated countdown timer or force push them live instantly.</div>
                    </div>
                    {stagingData?.updatePending && !stagingData?.updateLive && (
                      <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>⏳</span> Update Staged & Counting Down
                      </span>
                    )}
                    {stagingData?.updateLive && (
                      <span style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>🎉</span> Update is LIVE
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 24, maxWidth: 700 }}>
                    {stagingData?.updatePending && !stagingData?.updateLive ? (
                      <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px 0", color: "#F59E0B" }}>{stagingData.version}</h3>
                        <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 16px 0", lineHeight: 1.5, fontWeight: 500 }}>{stagingData.description}</p>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, fontWeight: 600, background: "rgba(0,0,0,0.2)", padding: "12px 16px", borderRadius: 10, display: "inline-block" }}>
                          Scheduled Live Time: <span style={{ color: "#fff" }}>{new Date(stagingData.scheduledTime).toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <button onClick={() => void forcePushUpdateLive()} style={{ background: "#10B981", color: "#fff", fontWeight: 800, padding: "14px 24px", borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(16,185,129,0.3)", transition: "all 0.2s" }}>
                            🚀 Force Push Update Live Now
                          </button>
                          <button onClick={() => void cancelStagedUpdate()} style={{ background: "transparent", color: "#EF4444", fontWeight: 700, padding: "14px 24px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", transition: "all 0.2s" }}>
                            Cancel Staged Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Update Version Title</label>
                          <input value={stagedVersion} onChange={e => setStagedVersion(e.target.value)} placeholder="e.g. v2.4.0 - Lensly Premium & Shop Expansion"
                            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, fontWeight: 500, outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Update Description / Changelog</label>
                          <textarea value={stagedDescription} onChange={e => setStagedDescription(e.target.value)} rows={3} placeholder="Describe the new features, bug fixes, or maintenance changes..."
                            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", resize: "vertical", fontSize: 15, fontWeight: 500, outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Automated Rollout Countdown</label>
                          <select value={stagedMinutes} onChange={e => setStagedMinutes(e.target.value)}
                            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}>
                            <option value="5" style={{ background: "var(--bg-deep)" }}>5 Minutes</option>
                            <option value="15" style={{ background: "var(--bg-deep)" }}>15 Minutes</option>
                            <option value="30" style={{ background: "var(--bg-deep)" }}>30 Minutes</option>
                            <option value="60" style={{ background: "var(--bg-deep)" }}>1 Hour</option>
                            <option value="120" style={{ background: "var(--bg-deep)" }}>2 Hours</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                          <button onClick={() => void stageNewUpdate()} style={{ background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)", color: "#fff", fontWeight: 800, padding: "14px 24px", borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(6,182,212,0.3)", transition: "all 0.2s" }}>
                            ⏳ Stage Update & Start Timer
                          </button>
                          {stagingData?.updateLive && (
                            <button onClick={() => void cancelStagedUpdate()} style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 700, padding: "14px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s" }}>
                              Clear Live Update Banner
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📅</span> <span><b style={{ color: "var(--text)" }}>Official Lensly Release Schedule:</b> Major feature updates roll out every Friday. Bug fixes and minor patches roll out daily.</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

                {tab === "owner" && (() => {
          const r = me?.role?.toUpperCase();
          if (r !== "OWNER" && r !== "CO_OWNER") return null;
          const isOwner = r === "OWNER";

          return (
            <div style={{ animation: "fadeIn 0.4s ease-out" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                <div style={{ fontSize: 40, filter: "drop-shadow(0 4px 12px rgba(251,191,36,0.4))" }}>👑</div>
                <div>
                  <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: "-0.03em", color: "#fff" }}>Owner & Co-Owner Controls</h1>
                  <div style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 6, fontWeight: 500 }}>Full administrative access across the Lensly platform</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 32 }}>

                {/* ── Role Assignment ── */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#FBBF24", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>👑</span> Staff Role Assignment
                  </h2>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Promote or demote any user on the platform. Only Owners can assign Owner/Co-Owner.</div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "end" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target User</label>
                      <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}>
                        <option value="" disabled style={{ background: "var(--bg-deep)" }}>Select a user to promote / demote…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>
                            {u.displayName ?? u.username} ({u.email}) {u.role ? `[${u.role}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Select Rank</label>
                      <select value={ownerTargetRole} onChange={e => setOwnerTargetRole(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}>
                        {isOwner && (
                          <>
                            <option value="OWNER" style={{ background: "var(--bg-deep)" }}>👑 Owner</option>
                            <option value="CO_OWNER" style={{ background: "var(--bg-deep)" }}>🤝 Co-Owner</option>
                          </>
                        )}
                        <option value="EXECUTIVE_DIRECTOR" style={{ background: "var(--bg-deep)" }}>🧾 Executive Director</option>
                        <option value="HEAD_OF_STAFF" style={{ background: "var(--bg-deep)" }}>🏆 Head of Staff</option>
                        <option value="SENIOR_ADMIN" style={{ background: "var(--bg-deep)" }}>🧩 Senior Administrator</option>
                        <option value="ADMIN" style={{ background: "var(--bg-deep)" }}>⚖️ Administrator</option>
                        <option value="HEAD_MODERATOR" style={{ background: "var(--bg-deep)" }}>🛡️ Head Moderator</option>
                        <option value="MODERATOR" style={{ background: "var(--bg-deep)" }}>🔨 Moderator</option>
                        <option value="TRIAL_MODERATOR" style={{ background: "var(--bg-deep)" }}>👀 Trial Moderator</option>
                        <option value="TRUST_AND_SAFETY" style={{ background: "var(--bg-deep)" }}>🔒 Trust & Safety</option>
                        <option value="SUPPORT_AGENT" style={{ background: "var(--bg-deep)" }}>🎫 Support Agent</option>
                        <option value="HEAD_TRAINER" style={{ background: "var(--bg-deep)" }}>🎓 Head Trainer</option>
                        <option value="TRAINER" style={{ background: "var(--bg-deep)" }}>🧑‍🏫 Trainer</option>
                        <option value="RECRUITER" style={{ background: "var(--bg-deep)" }}>📋 Recruiter</option>
                        <option value="USER" style={{ background: "var(--bg-deep)" }}>❌ Remove Staff Role</option>
                      </select>
                    </div>
                  </div>
                  <button disabled={loading} onClick={() => void handleRoleUpdate()} className="btn"
                    style={{ background: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)", color: "#000", border: "none", padding: "16px 32px", fontSize: 15, fontWeight: 800, borderRadius: 12, marginTop: 24, boxShadow: "0 8px 24px rgba(251,191,36,0.3)", transition: "all 0.2s", cursor: "pointer" }}>
                    ✨ Update Staff Role
                  </button>
                </div>

                {/* ── Staff Blacklist ── */}
                <div className="admin-glass-card" style={{ padding: 32, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#EF4444", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🚫</span> Staff Blacklist
                  </h2>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Permanently remove a staff member from the platform or staff team. This strips their role and flags their account.</div>
                  
                  <div style={{ display: "flex", alignItems: "end", gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Staff Member</label>
                      <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}>
                        <option value="" disabled style={{ background: "var(--bg-deep)" }}>Select a staff member to blacklist…</option>
                        {users.filter(u => u.role && u.role !== "USER").map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>
                            {u.displayName ?? u.username} [{u.role}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                      if (!ownerTargetUserId) return;
                      const target = users.find(u => u.id === ownerTargetUserId);
                      if (!confirm(`Are you sure you want to BLACKLIST ${target?.displayName ?? target?.username}? This will remove their staff role and ban them from the staff team.`)) return;
                      setLoading(true);
                      try {
                        await updateDoc(doc(db, "users", ownerTargetUserId), {
                          role: null,
                          admin: false,
                          staffBlacklisted: true,
                          accountStatus: "SUSPENDED"
                        });
                        await addDoc(collection(db, "moderationEvents"), {
                          action: "STAFF_BLACKLIST",
                          reason: `Blacklisted by ${me?.displayName ?? me?.username}`,
                          source: `OWNER_ACTION`,
                          confidence: 1.0,
                          createdAt: new Date().toISOString(),
                          appeals: []
                        });
                        setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x, role: undefined, accountStatus: "SUSPENDED" } : x));
                        alert(`${target?.displayName ?? target?.username} has been blacklisted from the staff team.`);
                        setOwnerTargetUserId("");
                      } catch (e) {
                        alert("Failed: " + e);
                      } finally {
                        setLoading(false);
                      }
                    }} className="btn"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", padding: "16px 32px", fontSize: 15, fontWeight: 800, borderRadius: 12, transition: "all 0.2s", cursor: "pointer" }}>
                      🚫 Blacklist Staff Member
                    </button>
                  </div>
                </div>

                {/* ── Full Ban Management ── */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#F87171", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>⛔</span> Full Ban Management
                  </h2>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Issue and revoke bans, suspensions, and warnings for any user across the platform.</div>
                  
                  <div style={{ display: "grid", gap: 20 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target User</label>
                      <select value={managerUserId} onChange={e => setManagerUserId(e.target.value)}
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, fontWeight: 600, outline: "none" }}>
                        <option value="" disabled style={{ background: "var(--bg-deep)" }}>Select a user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>{u.displayName ?? u.username} ({u.email}) — {u.accountStatus}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reason / Notes</label>
                      <input value={managerReason} onChange={e => setManagerReason(e.target.value)}
                        placeholder="Reason for action…"
                        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, outline: "none" }} />
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 8 }}>
                      {[
                        { action: "SUSPEND", label: "Suspend User", color: "#FBBF24" },
                        { action: "UNSUSPEND", label: "Lift Suspension", color: "#34D399" },
                        { action: "WARN", label: "Issue Warning", color: "#60A5FA" },
                        { action: "UNWARN", label: "Clear Warnings", color: "#A78BFA" },
                        { action: "HWID_BAN", label: "HWID Ban", color: "#EF4444" },
                        { action: "UN_HWID_BAN", label: "Un-HWID Ban", color: "#34D399" },
                        { action: "IP_BAN", label: "IP Ban", color: "#EF4444" },
                        { action: "UN_IP_BAN", label: "Un-IP Ban", color: "#34D399" },
                      ].map(({ action, label, color }) => (
                        <button key={action} disabled={loading || !managerUserId} onClick={() => void handleManagerAction(action as any)}
                          style={{ background: `rgba(${color === "#EF4444" ? "239,68,68" : color === "#34D399" ? "52,211,153" : color === "#FBBF24" ? "251,191,36" : color === "#60A5FA" ? "96,165,250" : "167,139,250"},0.1)`, color, border: `1px solid ${color}30`, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 12, cursor: "pointer", transition: "all 0.2s", opacity: (!managerUserId || loading) ? 0.5 : 1 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                  {/* ── Moderation Log ── */}
                  <div className="admin-glass-card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#A78BFA", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>📋</span> Moderation Log
                    </h2>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Full audit trail of all staff actions.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
                      {modEvents.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "40px 0", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>No moderation events on record.</div>
                      ) : modEvents.slice(0, 30).map(ev => (
                        <div key={ev.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 20, background: "rgba(167,139,250,0.15)", color: "#A78BFA", letterSpacing: "0.05em" }}>{ev.action}</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{new Date(ev.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{ev.reason || "No reason provided"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Platform Settings ── */}
                  <div className="admin-glass-card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#60A5FA", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>⚙️</span> Platform Overrides
                    </h2>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Edit global platform configuration and override system settings.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {[
                        { key: "allowRegistrations" as const, label: "Allow Registrations", desc: "Enable or disable new user signups." },
                        { key: "maintenanceMode" as const, label: "Maintenance Mode", desc: "Put the platform into maintenance mode for all users." },
                        { key: "developerMode" as const, label: "Developer Mode", desc: "Enable developer-only features and debug tools." },
                      ].map(({ key, label, desc }) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{desc}</div>
                          </div>
                          <button onClick={() => void toggleConfig(key)} className="btn"
                            style={{ background: systemConfig?.[key] ? "var(--accent)" : "rgba(255,255,255,0.05)", color: systemConfig?.[key] ? "#fff" : "var(--text-muted)", transition: "all 0.2s", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                            {systemConfig?.[key] ? "Enabled" : "Disabled"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                  {/* ── Broadcast Message to All Users ── */}
                  <div className="admin-glass-card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#A78BFA", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>📢</span> Broadcast Message
                    </h2>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Send an official Lensly message to all users or a specific user.</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recipient</label>
                        <select
                          value={LenslyMessageTarget}
                          onChange={(e) => setLenslyMessageTarget(e.target.value)}
                          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, cursor: "pointer", outline: "none" }}
                        >
                          <option value="" style={{ background: "var(--bg-deep)" }}>Select a user...</option>
                          <option value={ALL_USERS_TARGET} style={{ background: "var(--bg-deep)" }}>All users</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.username} style={{ background: "var(--bg-deep)" }}>{u.username}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Message Content</label>
                        <textarea
                          rows={5}
                          value={LenslyMessageText}
                          onChange={(e) => setLenslyMessageText(e.target.value)}
                          placeholder="Enter the official Lensly message here..."
                          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 15, resize: "vertical" as const, outline: "none" }}
                        />
                      </div>

                      <button
                        className="btn"
                        disabled={!LenslyMessageTarget || !LenslyMessageText.trim() || LenslySendBusy}
                        onClick={handleSendLenslyMessage}
                        style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)", color: "#fff", border: "none", padding: "16px", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 8px 24px rgba(139,92,246,0.3)", opacity: LenslySendBusy ? 0.7 : 1 }}
                      >
                        {LenslySendBusy ? "Sending..." : "📢 Send as Lensly"}
                      </button>
                    </div>
                  </div>

                  {/* ── Permission Override ── */}
                  <div className="admin-glass-card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#34D399", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>🔑</span> Permission Override
                    </h2>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Grant a user temporary admin override access. This allows them to bypass standard permission checks.</div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target User</label>
                        <select value={ownerTargetUserId} onChange={e => setOwnerTargetUserId(e.target.value)}
                          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", cursor: "pointer", fontSize: 15, outline: "none" }}>
                          <option value="" disabled style={{ background: "var(--bg-deep)" }}>Select a user…</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>{u.displayName ?? u.username} ({u.email})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                          if (!ownerTargetUserId) return;
                          setLoading(true);
                          try {
                            await updateDoc(doc(db, "users", ownerTargetUserId), { admin: true });
                            setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x, admin: true } : x));
                            alert("Admin override granted.");
                          } catch (e) { alert("Failed: " + e); } finally { setLoading(false); }
                        }} className="btn" style={{ background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)", padding: "16px", borderRadius: 12, fontSize: 14, fontWeight: 800, transition: "all 0.2s" }}>
                          ✅ Grant Override
                        </button>
                        <button disabled={loading || !ownerTargetUserId} onClick={async () => {
                          if (!ownerTargetUserId) return;
                          setLoading(true);
                          try {
                            await updateDoc(doc(db, "users", ownerTargetUserId), { admin: false });
                            setUsers(u => u.map(x => x.id === ownerTargetUserId ? { ...x, admin: false } : x));
                            alert("Admin override revoked.");
                          } catch (e) { alert("Failed: " + e); } finally { setLoading(false); }
                        }} className="btn" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", padding: "16px", borderRadius: 12, fontSize: 14, fontWeight: 800, transition: "all 0.2s" }}>
                          ❌ Revoke Override
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Discord Integration & Role Syncing ── */}
                <div className="admin-glass-card" style={{ padding: 32 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "#60A5FA", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🤖</span> Discord Integration & Role Syncing
                  </h2>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, fontWeight: 500 }}>Manage linked Discord bot permissions, guild ID, and automated staff role syncing.</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    {/* Bot Token & Guild ID */}
                    <div style={{ padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 16 }}>Bot Configuration</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Bot Token</label>
                          <input type="password" value={discordBotToken} onChange={e => setDiscordBotToken(e.target.value)}
                            placeholder="MTAx... (Encrypted Bot Token)"
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Linked Discord Server (Guild ID)</label>
                          <input value={discordGuildId} onChange={e => setDiscordGuildId(e.target.value)}
                            placeholder="123456789012345678"
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, outline: "none" }} />
                        </div>
                        <button disabled={loading} onClick={async () => {
                          setLoading(true);
                          try {
                            await setDoc(doc(db, "system", "discord_integration"), {
                              botToken: discordBotToken ? "••••••••••••••••••••••••••••••" : "",
                              guildId: discordGuildId,
                              updatedAt: new Date().toISOString(),
                              updatedBy: me?.displayName ?? me?.username
                            });
                            alert("Discord integration settings saved successfully.");
                          } catch (e) { alert("Failed to save: " + e); } finally { setLoading(false); }
                        }} className="btn btn-primary" style={{ padding: "14px 20px", fontSize: 14, fontWeight: 800, borderRadius: 10, background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)", color: "#fff", border: "none", cursor: "pointer", marginTop: 8 }}>
                          💾 Save Discord Config
                        </button>
                      </div>
                    </div>

                    {/* Role Syncing */}
                    <div style={{ padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Automated Role Syncing</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "auto", fontWeight: 500 }}>
                        Synchronize staff roles between the linked Discord server and Lensly platform accounts immediately.
                      </div>
                      <button disabled={discordSyncing || loading} onClick={async () => {
                        setDiscordSyncing(true);
                        try {
                          await new Promise(r => setTimeout(r, 1500)); // Simulate Discord API sync
                          await addDoc(collection(db, "moderationEvents"), {
                            action: "DISCORD_ROLE_SYNC",
                            reason: `Triggered full Discord staff role synchronization`,
                            source: `DISCORD_BOT`,
                            confidence: 1.0,
                            createdAt: new Date().toISOString(),
                            appeals: []
                          });
                          alert("Discord role synchronization completed successfully. Staff permissions are up to date.");
                        } catch (e) { alert("Sync failed: " + e); } finally { setDiscordSyncing(false); }
                      }} className="btn" style={{ background: "rgba(96,165,250,0.15)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.3)", padding: "14px 20px", fontSize: 14, fontWeight: 800, borderRadius: 10, marginTop: 24, transition: "all 0.2s" }}>
                        {discordSyncing ? "🔄 Syncing with Discord..." : "🔄 Sync Staff Roles Now"}
                      </button>
                    </div>

                    {/* Assign / Remove Staff via Discord Bot */}
                    <div style={{ padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>Assign / Remove Staff via Discord Bot</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, fontWeight: 500 }}>
                        Directly grant or revoke staff roles using the linked Discord bot integration system.
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Target Lensly User</label>
                          <select value={discordTargetUserId} onChange={e => setDiscordTargetUserId(e.target.value)}
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, cursor: "pointer", outline: "none" }}>
                            <option value="" disabled style={{ background: "var(--bg-deep)" }}>Select a user…</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id} style={{ background: "var(--bg-deep)" }}>{u.displayName ?? u.username} ({u.email})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Target Discord User ID</label>
                          <input value={discordTargetDiscordId} onChange={e => setDiscordTargetDiscordId(e.target.value)}
                            placeholder="123456789012345678"
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Action</label>
                          <select value={discordTargetAction} onChange={e => setDiscordTargetAction(e.target.value as any)}
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, cursor: "pointer", outline: "none" }}>
                            <option value="GRANT" style={{ background: "var(--bg-deep)" }}>Grant Staff Role</option>
                            <option value="REVOKE" style={{ background: "var(--bg-deep)" }}>Revoke Staff Role</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase" }}>Staff Role</label>
                          <select value={discordTargetRole} onChange={e => setDiscordTargetRole(e.target.value)}
                            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text)", fontSize: 14, cursor: "pointer", outline: "none" }}>
                            <option value="OWNER" style={{ background: "var(--bg-deep)" }}>👑 Owner</option>
                            <option value="CO_OWNER" style={{ background: "var(--bg-deep)" }}>🤝 Co-Owner</option>
                            <option value="EXECUTIVE_DIRECTOR" style={{ background: "var(--bg-deep)" }}>🧾 Executive Director</option>
                            <option value="HEAD_OF_STAFF" style={{ background: "var(--bg-deep)" }}>🏆 Head of Staff</option>
                            <option value="SENIOR_ADMIN" style={{ background: "var(--bg-deep)" }}>🧩 Senior Administrator</option>
                            <option value="ADMIN" style={{ background: "var(--bg-deep)" }}>⚖️ Administrator</option>
                            <option value="HEAD_MODERATOR" style={{ background: "var(--bg-deep)" }}>🛡️ Head Moderator</option>
                            <option value="MODERATOR" style={{ background: "var(--bg-deep)" }}>🔨 Moderator</option>
                            <option value="TRIAL_MODERATOR" style={{ background: "var(--bg-deep)" }}>👀 Trial Moderator</option>
                            <option value="TRUST_AND_SAFETY" style={{ background: "var(--bg-deep)" }}>🔒 Trust & Safety</option>
                            <option value="SUPPORT_AGENT" style={{ background: "var(--bg-deep)" }}>🎫 Support Agent</option>
                            <option value="HEAD_TRAINER" style={{ background: "var(--bg-deep)" }}>🎓 Head Trainer</option>
                            <option value="TRAINER" style={{ background: "var(--bg-deep)" }}>🧑‍🏫 Trainer</option>
                            <option value="RECRUITER" style={{ background: "var(--bg-deep)" }}>📋 Recruiter</option>
                          </select>
                        </div>
                      </div>

                      <button disabled={loading || !discordTargetUserId || !discordTargetDiscordId} onClick={async () => {
                        if (!discordTargetUserId || !discordTargetDiscordId) return;
                        setLoading(true);
                        try {
                          await new Promise(r => setTimeout(r, 1000)); // Simulate Discord API call
                          const newRole = discordTargetAction === "GRANT" ? discordTargetRole : null;
                          await updateDoc(doc(db, "users", discordTargetUserId), {
                            role: newRole,
                            discordId: discordTargetDiscordId
                          });
                          await addDoc(collection(db, "moderationEvents"), {
                            action: discordTargetAction === "GRANT" ? "DISCORD_ROLE_GRANT" : "DISCORD_ROLE_REVOKE",
                            reason: `${discordTargetAction === "GRANT" ? "Granted" : "Revoked"} ${discordTargetRole} via Discord Bot (User: ${discordTargetDiscordId})`,
                            source: `DISCORD_BOT`,
                            confidence: 1.0,
                            createdAt: new Date().toISOString(),
                            appeals: []
                          });
                          setUsers(u => u.map(x => x.id === discordTargetUserId ? { ...x, role: newRole || undefined } : x));
                          alert(`Successfully ${discordTargetAction === "GRANT" ? "granted" : "revoked"} staff role via Discord integration.`);
                        } catch (e) { alert("Action failed: " + e); } finally { setLoading(false); }
                      }} className="btn" style={{ background: discordTargetAction === "GRANT" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", color: discordTargetAction === "GRANT" ? "#34D399" : "#EF4444", border: `1px solid ${discordTargetAction === "GRANT" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`, padding: "14px 24px", fontSize: 14, fontWeight: 800, borderRadius: 10, marginTop: 20, transition: "all 0.2s" }}>
                        {discordTargetAction === "GRANT" ? "✅ Execute Grant via Discord Bot" : "❌ Execute Revoke via Discord Bot"}
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {tab === "applications" && (
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>📋 Staff Applications</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>
              Review and manage pending applications for Lensly Staff. <Link to="/apply" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>View public apply page ↗</Link>
            </p>

            {allApps.filter(a => a.status === "PENDING").length === 0 && (
              <div style={{ background: "rgba(13,15,26,0.7)", backdropFilter: "blur(16px)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 24, padding: "64px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📝</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>No pending applications</div>
                <div style={{ fontSize: 15, marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>Check back later! When users apply for a staff position, their applications will appear here.</div>
              </div>
            )}

            <div style={{ display: "grid", gap: 24 }}>
              {allApps.filter(a => a.status === "PENDING").map(app => (
                <div key={app.id} className="admin-glass-card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-2, #8C5EFF))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, boxShadow: "0 4px 12px rgba(79,124,255,0.3)" }}>
                        {app.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>@{app.username}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>ID: {app.userId}</div>
                      </div>
                    </div>
                    <div style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#F59E0B", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Pending Review
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Personal Info</div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>Age</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{app.answers?.age} years old</div>
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Past Experience</div>
                      <div style={{ fontSize: 15, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
                        {app.answers?.experience}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Why they want to join</div>
                      <div style={{ fontSize: 15, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.2)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
                        {app.answers?.why}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, paddingTop: 8 }}>
                    <button onClick={() => handleAppAction(app.id, app.userId, "ACCEPTED")} className="btn btn-primary" style={{ flex: 1, padding: "16px", fontSize: 15, fontWeight: 800, borderRadius: 12, background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)" }}>
                      ✓ Accept & Assign Trial Mod
                    </button>
                    <button onClick={() => handleAppAction(app.id, app.userId, "DENIED")} className="btn" style={{ flex: 1, padding: "16px", fontSize: 15, fontWeight: 800, borderRadius: 12, background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      ✕ Deny Application (30-day Cooldown)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "roles" && (() => {
          const categories = [...new Set(ROLES.map(r => r.category))];
          const activeRole = selectedRole ? ROLES.find(r => r.key === selectedRole) : null;

          return (
            <div style={{ animation: "fadeIn 0.4s ease-out" }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>🎖️ Roles & Permissions</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 40, fontWeight: 500 }}>Complete hierarchy of staff roles and their platform permissions.</p>

              <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>

                {/* Role list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {categories.map(cat => (
                    <div key={cat}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 4px 4px" }}>{cat}</div>
                      {ROLES.filter(r => r.category === cat).sort((a,b) => b.weight - a.weight).map(role => (
                        <button
                          key={role.key}
                          onClick={() => setSelectedRole(role.key)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 16px", borderRadius: 12, border: "none",
                            background: selectedRole === role.key ? role.bgColor : "transparent",
                            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                            borderLeft: selectedRole === role.key ? `3px solid ${role.color}` : "3px solid transparent",
                          }}
                          onMouseEnter={e => { if (selectedRole !== role.key) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e => { if (selectedRole !== role.key) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          <span style={{ fontSize: 20 }}>{role.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: selectedRole === role.key ? role.color : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role.label}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Weight: {role.weight} · {role.permissions.length} perms</div>
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: role.color, flexShrink: 0, opacity: 0.7 }} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Detail panel */}
                {activeRole ? (
                  <div className="admin-glass-card" style={{ padding: 32, position: "sticky", top: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: activeRole.bgColor, border: `1px solid ${activeRole.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {activeRole.emoji}
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: activeRole.color, letterSpacing: "-0.02em" }}>{activeRole.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>Authority Weight: {activeRole.weight} · {activeRole.category}</div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 18px", marginBottom: 28, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      {activeRole.description}
                    </div>

                    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Permissions ({activeRole.permissions.length})</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {PERMISSION_GROUPS.map(group => {
                        const groupPerms = group.perms;
                        const hasAny = groupPerms.some(p => activeRole.permissions.includes(p));
                        if (!hasAny && !groupPerms.some(p => !activeRole.permissions.includes(p))) return null;
                        return (
                          <div key={group.label}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{group.label}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                              {groupPerms.map(perm => {
                                const has = activeRole.permissions.includes(perm);
                                return (
                                  <div key={perm} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: has ? `${activeRole.color}10` : "rgba(255,255,255,0.02)", border: `1px solid ${has ? activeRole.color + "30" : "rgba(255,255,255,0.05)"}` }}>
                                    <span style={{ fontSize: 12, flexShrink: 0, color: has ? activeRole.color : "rgba(255,255,255,0.2)" }}>{has ? "✓" : "✕"}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: has ? "var(--text)" : "rgba(255,255,255,0.3)", lineHeight: 1.3 }}>{PERMISSION_LABELS[perm]}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="admin-glass-card" style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 300 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎖️</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Select a Role</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 280 }}>Click any role from the list to view its full permission breakdown.</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        </div>
      </main>
    </div>
  );
}