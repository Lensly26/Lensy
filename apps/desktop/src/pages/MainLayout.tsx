import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../lib/auth-store.js";
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc,
  serverTimestamp, arrayUnion, where, deleteDoc, getDoc, getDocs, setDoc, limit
} from "firebase/firestore";
import { db } from "../lib/firebase.js";

// ── Types ─────────────────────────────────────────────────────────────────
type Channel = { id: string; name: string; type: string; categoryId?: string; userLimit?: number };
type RoleType = { id: string; name: string; color: string; permissions: string[]; hoist?: boolean };
type Guild = {
  id: string; name: string; iconUrl: string | null; ownerId: string;
  suspended: boolean; channels: Channel[]; members: string[];
  roles?: RoleType[]; memberRoles?: Record<string, string[]>;
  boostCount?: number; isPublic?: boolean; description?: string;
  hideMemberList?: boolean;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  strikes?: number;
  raidProtection?: boolean;
  verificationLevel?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  autoModEnabled?: boolean;
  autoModScam?: boolean;
  autoModVulgar?: boolean;
  autoModSpam?: boolean;
  bannerUrl?: string | null;
  discoveryStatus?: "NOT_DISCOVERABLE" | "PENDING" | "APPROVED" | "REJECTED" | "NONE";
  discoveryRequest?: { requestedAt: string; requestedBy: string; rejectReason?: string; whyJoin?: string; memberCount?: number; category?: string; guidelines?: boolean; };
};
type Attachment = { url: string; name: string; type: string };
type ReplyRef = { id: string; content: string; authorName: string };
type Message = {
  id: string; content: string; createdAt: string;
  editedAt?: string; editedContent?: string;
  replyTo?: ReplyRef;
  attachments?: Attachment[];
  reactions?: Record<string, string[]>;
  pinnedBy?: string; pinnedAt?: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; badges?: { badge: { slug: string; label: string } }[] };
};
type Presence = "ONLINE" | "DND" | "IDLE" | "OFFLINE";
type ModerationAlert = { action: string; reason: string } | null;
type UserType = {
  id: string; username: string; displayName: string | null; avatarUrl: string | null;
  presenceStatus: string; statusLine?: string | null; bio?: string | null;
  userBadges?: { badge: { slug: string; label: string } }[];
  friends?: string[]; blockedUsers?: string[];
  staffBlacklisted?: boolean;
  staffNotes?: string | null;
};
type FriendRequest = { fromId: string; fromUsername: string; fromDisplayName: string | null; fromAvatarUrl: string | null; sentAt: string };

// ── Constants ──────────────────────────────────────────────────────────────
const PRESENCE_COLORS: Record<Presence, string> = { ONLINE: "#34D399", DND: "#EF4444", IDLE: "#FBBF24", OFFLINE: "#4A5270" };
const PRESENCE_LABELS: Record<Presence, string> = { ONLINE: "Online", DND: "Do Not Disturb", IDLE: "Idle", OFFLINE: "Offline" };

const BADGE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  staff:           { bg: "rgba(79,124,255,0.2)",   color: "#4F7CFF",  label: "⚙️ Staff" },
  "senior-staff":  { bg: "rgba(140,94,255,0.2)",   color: "#8C5EFF",  label: "🛡️ Senior Staff" },
  admin:           { bg: "rgba(255,94,173,0.2)",   color: "#FF5EAD",  label: "👑 Admin" },
  "early-supporter":{ bg: "rgba(251,191,36,0.2)", color: "#FBBF24",  label: "⭐ Early Supporter" },
  supporter:       { bg: "rgba(251,191,36,0.2)",   color: "#FBBF24",  label: "💛 Supporter" },
  verified:        { bg: "rgba(52,211,153,0.2)",   color: "#34D399",  label: "✓ Verified" },
  developer:       { bg: "rgba(6,182,212,0.2)",    color: "#06B6D4",  label: "💻 Developer" },
  owner:           { bg: "rgba(245,158,11,0.2)",   color: "#F59E0B",  label: "👑 Owner" },
  booster:         { bg: "rgba(255,94,173,0.15)",  color: "#FF5EAD",  label: "🚀 Server Booster" },
};

const QUICK_EMOJI = ["👍","❤️","😂","🔥","😮","😢","🎉","✅","🚀","💯","😍","🤔","👀","💀","🥰","😎"];

const SERVER_TEMPLATES = [
  { id: "blank",  icon: "📄", name: "Blank",        desc: "Start fresh — no channels", channels: [] },
  { id: "gaming", icon: "🎮", name: "Gaming",        desc: "Channels for your gaming community",
    channels: [
      { id: "g1", name: "welcome", type: "TEXT" }, { id: "g2", name: "rules", type: "TEXT" },
      { id: "g3", name: "general", type: "TEXT" }, { id: "g4", name: "gaming-chat", type: "TEXT" },
      { id: "g5", name: "clips-and-highlights", type: "TEXT" }, { id: "g6", name: "looking-for-party", type: "TEXT" },
      { id: "g7", name: "General Voice", type: "VOICE" }, { id: "g8", name: "Gaming Voice", type: "VOICE" },
    ]
  },
  { id: "community", icon: "🌍", name: "Community",   desc: "Perfect for building a thriving community",
    channels: [
      { id: "c1", name: "announcements", type: "TEXT" }, { id: "c2", name: "rules", type: "TEXT" },
      { id: "c3", name: "introductions", type: "TEXT" }, { id: "c4", name: "general", type: "TEXT" },
      { id: "c5", name: "media", type: "TEXT" }, { id: "c6", name: "off-topic", type: "TEXT" },
      { id: "c7", name: "Lounge Voice", type: "VOICE" }, { id: "c8", name: "Community Voice", type: "VOICE" },
    ]
  },
  { id: "study", icon: "📚", name: "Study Group",    desc: "Stay focused and learn together",
    channels: [
      { id: "s1", name: "general", type: "TEXT" }, { id: "s2", name: "resources", type: "TEXT" },
      { id: "s3", name: "questions", type: "TEXT" }, { id: "s4", name: "off-topic", type: "TEXT" },
      { id: "s5", name: "Study Room 1", type: "VOICE" }, { id: "s6", name: "Study Room 2", type: "VOICE" },
    ]
  },
  { id: "art", icon: "🎨", name: "Art & Creative",  desc: "Share your creative work",
    channels: [
      { id: "a1", name: "showcase", type: "TEXT" }, { id: "a2", name: "feedback", type: "TEXT" },
      { id: "a3", name: "wip", type: "TEXT" }, { id: "a4", name: "general", type: "TEXT" },
      { id: "a5", name: "Creative Lounge", type: "VOICE" },
    ]
  },
];

const BOOST_PERKS = [
  { level: 1, count: 2,  label: "Level 1", color: "#8C5EFF", perks: ["Animated server icon", "Custom invite background"] },
  { level: 2, count: 7,  label: "Level 2", color: "#4F7CFF", perks: ["Higher quality voice (128kbps)", "Custom banner", "Emoji slots +50"] },
  { level: 3, count: 14, label: "Level 3", color: "#FF5EAD", perks: ["Best voice quality (384kbps)", "Custom domain invite", "Emoji slots +100", "Exclusive Level 3 badge"] },
];

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ user, size = 40, isSpeaking = false }: { user: { id?: string | null; username: string; avatarUrl?: string | null; displayName?: string | null }; size?: number; isSpeaking?: boolean }) {
  const initial = (user.displayName ?? user.username)[0]?.toUpperCase() ?? "?";
  const colors = ["#4F7CFF", "#8C5EFF", "#FF5EAD", "#34D399", "#FBBF24", "#F97316"];
  const color = colors[(user.username?.charCodeAt(0) ?? 0) % colors.length];

  const borderStyle = isSpeaking
    ? { border: "2px solid #34D399", boxShadow: "0 0 6px #34D399", boxSizing: "border-box" as const }
    : {};

  const isSystemBot = user.id === "Lensly_system" || user.username === "Lensly_system" || user.username?.toLowerCase() === "lensly";
  const avatarSrc = isSystemBot ? "/logo.png" : user.avatarUrl;

  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt={user.username}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          transition: "all 0.15s ease",
          ...borderStyle
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.36,
        color: "#fff",
        flexShrink: 0,
        transition: "all 0.15s ease",
        ...borderStyle
      }}
    >
      {initial}
    </div>
  );
}

// ── Typing dots ────────────────────────────────────────────────────────────
function TypingDots() {
  return <span className="typing-dots"><span /><span /><span /></span>;
}

// ── Web Audio Synth Sounds ──────────────────────────────────────────────────
function playJoinSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play first note (lower)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);
    
    // Play second note (higher) slightly later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(554.37, ctx.currentTime + 0.12); // C#5
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Failed to play join sound:", e);
  }
}

function playLeaveSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play first note (higher)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(554.37, ctx.currentTime); // C#5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.3);
    
    // Play second note (lower) slightly later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(440, ctx.currentTime + 0.12); // A4
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Failed to play leave sound:", e);
  }
}

function playNotificationSound(soundType: string, volume = 0.08) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    const vol = Math.max(0.001, Math.min(volume, 1.0));
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.connect(ctx.destination);

    if (soundType === "beep") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (soundType === "playful") {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(vol, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.1);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(vol, ctx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.22);
    } else if (soundType === "cyber") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (soundType === "alert") {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (soundType === "retro") {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.28);
    } else {
      // chime (default)
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn("Failed to play notification sound:", e);
  }
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);

  // ── Core state & Offline caching
  const [guilds, setGuilds] = useState<Guild[]>(() => {
    try {
      const cached = localStorage.getItem("gc_cache_guilds");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [activeGuildId, setActiveGuildId] = useState<string | null>(() => localStorage.getItem("gc_cache_active_guild"));
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => localStorage.getItem("gc_cache_active_channel"));
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const cached = localStorage.getItem("gc_cache_messages");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [draft, setDraft] = useState("");
  const [presence, setPresence] = useState<Presence>("ONLINE");
  const [modAlert, setModAlert] = useState<ModerationAlert>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>(() => {
    try {
      const cached = localStorage.getItem("gc_cache_users");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserType | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  // Sync cache changes to localStorage
  useEffect(() => {
    try { localStorage.setItem("gc_cache_guilds", JSON.stringify(guilds)); } catch {}
  }, [guilds]);
  useEffect(() => {
    if (activeGuildId) { localStorage.setItem("gc_cache_active_guild", activeGuildId); }
  }, [activeGuildId]);
  useEffect(() => {
    if (activeChannelId) { localStorage.setItem("gc_cache_active_channel", activeChannelId); }
  }, [activeChannelId]);
  useEffect(() => {
    try { localStorage.setItem("gc_cache_messages", JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => {
    try { localStorage.setItem("gc_cache_users", JSON.stringify(allUsers)); } catch {}
  }, [allUsers]);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen to system config to enable discovery workflow
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDiscoveryWorkflowEnabled(!!data.discoveryWorkflowEnabled);
      } else {
        setDiscoveryWorkflowEnabled(false);
      }
    }, (err) => {
      console.warn("Could not read system config for discoveryWorkflowEnabled in MainLayout:", err.message);
      setDiscoveryWorkflowEnabled(false);
    });
    return () => unsub();
  }, []);

  const [globalUpdateSha, setGlobalUpdateSha] = useState<string | null>(null);
  const [deployedSha, setDeployedSha] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);

  useEffect(() => {
    const checkGithub = async () => {
      try {
        const lastCheck = localStorage.getItem("gc_gh_check_time");
        const cachedSha = localStorage.getItem("gc_gh_check_sha");
        const now = Date.now();
        if (lastCheck && now - parseInt(lastCheck) < 5 * 60 * 1000) {
          if (cachedSha) setGlobalUpdateSha(cachedSha);
          return;
        }
        const res = await fetch("https://api.github.com/repos/Lensly25/Lensly/commits/main");
        const data = await res.json();
        if (data && data.sha) {
          localStorage.setItem("gc_gh_check_time", now.toString());
          localStorage.setItem("gc_gh_check_sha", data.sha);
          setGlobalUpdateSha(data.sha);
        }
      } catch (err) {
        console.warn("Failed to check GitHub:", err);
      }
    };
    checkGithub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "update_staging"), (snap) => {
      if (snap.exists()) {
        setDeployedSha(snap.data().deployedCommitSha || null);
        setUpdatePending(snap.data().updatePending || false);
      }
    });
    return () => unsub();
  }, []);

  const showGlobalUpdateBanner = updatePending;

  // Automatic crash monitoring
  useEffect(() => {
    const handleCrash = (message: string, source: string, lineno: number, colno: number, error: any) => {
      const crashLog = {
        timestamp: new Date().toISOString(),
        message: message || "Unknown error",
        source: source || "Script",
        lineno: lineno || 0,
        colno: colno || 0,
        stack: error?.stack || null,
        url: window.location.href,
      };
      try {
        const logs = JSON.parse(localStorage.getItem("gc_crash_reports") || "[]");
        logs.push(crashLog);
        localStorage.setItem("gc_crash_reports", JSON.stringify(logs.slice(-10)));
      } catch (err) {}
    };

    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      handleCrash(String(message), String(source), lineno || 0, colno || 0, error);
      if (originalOnError) return originalOnError(message, source, lineno, colno, error);
      return false;
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      handleCrash(
        `Unhandled Rejection: ${String(event.reason)}`,
        "Promise",
        0,
        0,
        event.reason
      );
    };
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.onerror = originalOnError;
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // ── Server management state
  const [showNewServer, setShowNewServer] = useState(false);
  const [addServerTab, setAddServerTab] = useState<"CREATE" | "JOIN" | "TEMPLATES">("TEMPLATES");
  const [newGuildName, setNewGuildName] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(SERVER_TEMPLATES[0]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"TEXT" | "VOICE" | "CATEGORY">("TEXT");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // ── Server Boost
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showBoostCheckout, setShowBoostCheckout] = useState(false);
  const [checkoutCard, setCheckoutCard] = useState("");
  const [checkoutExpiry, setCheckoutExpiry] = useState("");
  const [checkoutCvv, setCheckoutCvv] = useState("");
  const [checkoutName, setCheckoutName] = useState("");

  // ── Server Discovery
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [publicGuilds, setPublicGuilds] = useState<Guild[]>([]);
  const [discoverySearch, setDiscoverySearch] = useState("");
  
  // ── Server Discovery Application Form State
  const [discoveryWorkflowEnabled, setDiscoveryWorkflowEnabled] = useState(false);
  const [showDiscoveryForm, setShowDiscoveryForm] = useState(false);
  const [discoveryWhyJoin, setDiscoveryWhyJoin] = useState("");
  const [discoveryMemberCount, setDiscoveryMemberCount] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState("Social");
  const [discoveryGuidelines, setDiscoveryGuidelines] = useState("");

  // ── Roles
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [rolesTab, setRolesTab] = useState<"ROLES" | "MEMBERS">("ROLES");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#4F7CFF");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // ── DMs
  const [dmUser, setDmUser] = useState("");
  const [localDMs, setLocalDMs] = useState<string[]>(() => {
    try { const s = localStorage.getItem("Lensly_local_dms"); return s ? JSON.parse(s) : ["Lensly"]; } catch { return ["Lensly"]; }
  });
  const [showGroupDmModal, setShowGroupDmModal] = useState(false);
  const [groupDmName, setGroupDmName] = useState("");
  const [groupDmSearch, setGroupDmSearch] = useState("");
  const [groupDmSelected, setGroupDmSelected] = useState<string[]>([]);
  const [editingStaffNotes, setEditingStaffNotes] = useState("");
  // ── Friends
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [myFriends, setMyFriends] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendsTab, setFriendsTab] = useState<"ALL" | "REQUESTS" | "BLOCKED">("ALL");

  // ── Messaging features
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState<"INPUT" | string>("INPUT"); // messageId or "INPUT"
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [serverContextMenu, setServerContextMenu] = useState<{ x: number; y: number; guildId: string; guildName: string } | null>(null);
  const [memberContextMenu, setMemberContextMenu] = useState<{ x: number; y: number; userId: string; user: any } | null>(null);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [assignRolesTarget, setAssignRolesTarget] = useState<{ userId: string; user: any } | null>(null);
  const [reportingGuild, setReportingGuild] = useState<Guild | null>(null);
  const [reportReason, setReportReason] = useState("");

  // ── Typing indicators
  const [typingUsers, setTypingUsers] = useState<{ id: string; username: string }[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ── Voice / VC state
  const [inCall, setInCall] = useState(false);
  const [activeVcChannelId, setActiveVcChannelId] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [vcUsers, setVcUsers] = useState<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }[]>([]);
  const [vcState, setVcState] = useState<Record<string, { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]>>({});
  const prevVcUsersRef = useRef<string[]>([]);
  const isFirstVcSnapshotRef = useRef(true);
  const [pttEnabled, setPttEnabled] = useState(() => localStorage.getItem("gc_ptt") === "1");
  const [pttHeld, setPttHeld] = useState(false);
  const [noiseSuppress, setNoiseSuppress] = useState(() => localStorage.getItem("gc_noise") !== "0");
  const [streamQuality, setStreamQuality] = useState<"LOW" | "MED" | "HIGH">(() => (localStorage.getItem("gc_quality") as any) || "HIGH");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showVcPanel, setShowVcPanel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Web Audio Context for speaking detection
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({});

  const monitorStream = useCallback((userId: string, stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      // Cleanup existing analyser if any
      const existing = analysersRef.current.get(userId);
      if (existing) {
        try { existing.disconnect(); } catch {}
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      analysersRef.current.set(userId, analyser);
    } catch (err) {
      console.warn("Failed to monitor stream for speaking status:", err);
    }
  }, []);

  const cleanupWebAudio = useCallback(() => {
    analysersRef.current.forEach((analyser) => {
      try { analyser.disconnect(); } catch {}
    });
    analysersRef.current.clear();
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setSpeakingUsers({});
  }, []);

  // Sync PTT and noise settings from localStorage
  useEffect(() => {
    const handleStorage = () => {
      setPttEnabled(localStorage.getItem("gc_ptt") === "1");
      setNoiseSuppress(localStorage.getItem("gc_noise") !== "0");
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleStorage);
    };
  }, []);

  // Handle local microphone transmission state based on Mute and PTT
  useEffect(() => {
    if (!audioStreamRef.current) return;
    const isTransmitting = !isMuted && (!pttEnabled || pttHeld);
    audioStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = isTransmitting;
    });
  }, [pttEnabled, pttHeld, isMuted]);

  // Speaking state analysis polling loop
  useEffect(() => {
    let intervalId: any;
    if (activeVcChannelId) {
      intervalId = setInterval(() => {
        const speaking: Record<string, boolean> = {};
        analysersRef.current.forEach((analyser, userId) => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Threshold for speaking detection
          speaking[userId] = average > 12;
        });

        // Mute local speaking if muted or PTT isn't active
        if (me && speaking[me.id] && (isMuted || (pttEnabled && !pttHeld))) {
          speaking[me.id] = false;
        }

        setSpeakingUsers(speaking);
      }, 100);
    } else {
      setSpeakingUsers({});
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeVcChannelId, isMuted, pttEnabled, pttHeld, me?.id]);

  const rtcIceServers = useMemo(() => {
    const servers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19002" },
      { urls: "stun:stun1.l.google.com:19002" },
      { urls: "stun:stun2.l.google.com:19002" }
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

    if (turnUrl && turnUsername && turnCredential) {
      servers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      });
    } else {
      // Fallback to a public TURN relay so NAT/firewall environments can still connect.
      servers.push({
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        username: "webrtc",
        credential: "webrtc"
      });
    }

    return servers;
  }, []);

  // WebRTC Peer Connection Helper
  function createPeerConnection(otherUserId: string, isCaller: boolean) {
    if (!activeVcChannelId || !me) return null;
    
    // Cleanup existing connection to this user just in case
    const existingPc = pcsRef.current.get(otherUserId);
    if (existingPc) {
      try { existingPc.close(); } catch {}
    }

    const pc = new RTCPeerConnection({
      iceServers: rtcIceServers
    });

    pcsRef.current.set(otherUserId, pc);

    pc.oniceconnectionstatechange = () => {
      console.debug("RTC connection state", otherUserId, pc.connectionState, pc.iceConnectionState);
      if (pc.connectionState === "failed" || pc.iceConnectionState === "failed") {
        console.warn("WebRTC connection failed for", otherUserId, "- trying to recover");
      }
    };

    // Add local tracks
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, audioStreamRef.current!);
      });
    }

    // Play remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        let audio = audioRefs.current.get(otherUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          audioRefs.current.set(otherUserId, audio);
        }
        audio.volume = isDeafened ? 0 : 1;
        audio.srcObject = remoteStream;
        audio.play().catch(err => console.error("Error playing remote peer stream:", err));

        // Start monitoring this stream for speaking status
        monitorStream(otherUserId, remoteStream);
      }
    };

    const callId = [me.id, otherUserId].sort().join("_");
    const callRef = doc(db, `voiceChannels/${activeVcChannelId}/calls`, callId);

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateField = isCaller ? "callerCandidates" : "calleeCandidates";
        void updateDoc(callRef, {
          [candidateField]: arrayUnion((event.candidate as any).toJSON())
        }).catch(() => {});
      }
    };

    // If caller, negotiate offer
    if (isCaller) {
      void (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await setDoc(callRef, {
            offer: (offer as any).toJSON(),
            callerCandidates: [],
            calleeCandidates: [],
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Failed to create offer:", e);
        }
      })();
    }

    return pc;
  }

  // Deafen support
  useEffect(() => {
    audioRefs.current.forEach((audio) => {
      audio.volume = isDeafened ? 0 : 1;
    });
  }, [isDeafened]);

  // Coordinate connections as users join / leave
  useEffect(() => {
    if (!activeVcChannelId || !me) return;

    const otherUsers = vcUsers.filter(u => u.id !== me.id);
    const otherUserIds = otherUsers.map(u => u.id);

    // 1. Cleanup users who left
    pcsRef.current.forEach((pc, userId) => {
      if (!otherUserIds.includes(userId)) {
        try { pc.close(); } catch {}
        pcsRef.current.delete(userId);
        const audio = audioRefs.current.get(userId);
        if (audio) {
          audio.srcObject = null;
          audio.remove();
          audioRefs.current.delete(userId);
        }
        // Cleanup analyser
        const analyser = analysersRef.current.get(userId);
        if (analyser) {
          try { analyser.disconnect(); } catch {}
          analysersRef.current.delete(userId);
        }
      }
    });

    // 2. Initiate connections to new users if we are the caller
    otherUsers.forEach(user => {
      if (!pcsRef.current.has(user.id)) {
        const isCaller = me.id < user.id;
        if (isCaller) {
          createPeerConnection(user.id, true);
        }
      }
    });
  }, [vcUsers, activeVcChannelId, me?.id]);

  // Listen to WebRTC signaling documents
  useEffect(() => {
    if (!activeVcChannelId || !me) {
      pcsRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcsRef.current.clear();
      audioRefs.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      audioRefs.current.clear();
      cleanupWebAudio();
      return;
    }

    const q = collection(db, `voiceChannels/${activeVcChannelId}/calls`);
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(async (change) => {
        const callId = change.doc.id;
        const parts = callId.split("_");
        if (!parts.includes(me.id)) return;

        const otherUserId = parts.find(id => id !== me.id);
        if (!otherUserId) return;

        const data = change.doc.data();
        if (change.type === "added" || change.type === "modified") {
          let pc: RTCPeerConnection | undefined = pcsRef.current.get(otherUserId);
          const isCaller = me.id < otherUserId;

          if (!pc) {
            pc = createPeerConnection(otherUserId, isCaller) || undefined;
          }

          if (!pc) return;

          if (isCaller) {
            if (data.answer && pc.signalingState === "have-local-offer") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              } catch (e) {
                console.error("Error setting remote description on caller:", e);
              }
            }
            if (data.calleeCandidates && Array.isArray(data.calleeCandidates)) {
              for (const cand of data.calleeCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            }
          } else {
            if (data.offer && pc.signalingState === "stable") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                const callRef = doc(db, `voiceChannels/${activeVcChannelId}/calls`, callId);
                await updateDoc(callRef, {
                  answer: (answer as any).toJSON()
                });
              } catch (e) {
                console.error("Error setting remote offer/answering on callee:", e);
              }
            }
            if (data.callerCandidates && Array.isArray(data.callerCandidates)) {
              for (const cand of data.callerCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            }
          }
        }
      });
    });

    return () => {
      unsub();
      pcsRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcsRef.current.clear();
      audioRefs.current.forEach((audio) => {
        audio.srcObject = null;
        audio.remove();
      });
      audioRefs.current.clear();
      cleanupWebAudio();
    };
  }, [activeVcChannelId, me?.id]);

  // ── Preferences settings for sound
  const [prefs, setPrefs] = useState<{ soundEnabled: boolean; notificationSound: string; dmSound: string; mentionSound: string; serverSound: string; callSound: string; vcSound: string; dmVolume: number; mentionVolume: number; serverVolume: number; callVolume: number; vcVolume: number; masterVolume: number; dndEnabled: boolean; mutedGuildIds: string[] }>({ soundEnabled: true, notificationSound: "chime", dmSound: "chime", mentionSound: "alert", serverSound: "chime", callSound: "playful", vcSound: "beep", dmVolume: 0.8, mentionVolume: 1.0, serverVolume: 0.6, callVolume: 0.9, vcVolume: 0.7, masterVolume: 0.8, dndEnabled: false, mutedGuildIds: [] });
  useEffect(() => {
    if (!me?.id) return;
    const unsub = onSnapshot(doc(db, "settings", me.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPrefs(prev => ({
          ...prev,
          soundEnabled: data.soundEnabled !== false,
          notificationSound: data.notificationSound || "chime",
        }));
      }
    });
    return () => unsub();
  }, [me?.id]);

  // ── Presence/status
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const [customStatus, setCustomStatus] = useState(() => me?.statusLine || "");
  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSelectedInitial = useRef(false);

  const activeGuild = useMemo(() => guilds.find((g) => g.id === activeGuildId) ?? null, [guilds, activeGuildId]);
  const activeGuildHasAdmin = useMemo(() => {
    if (!activeGuild || !me) return false;
    if (activeGuild.ownerId === me.id) return true;
    const defaultRole = activeGuild.roles?.find(r => r.id === "default") || { id: "default", permissions: ["SEND_MESSAGES"] };
    const baseGuildPerms = [
      ...(defaultRole.permissions || []),
      ...((activeGuild.memberRoles || {})[me.id]?.flatMap(rid => activeGuild.roles?.find(r => r.id === rid)?.permissions || []) || [])
    ];
    const myGuildPermissions = [...baseGuildPerms, ...(me.role?.toUpperCase() === "DEVELOPER" ? ["ADMINISTRATOR"] : [])];
    return ["ADMINISTRATOR", "MANAGE_SERVER"].some(p => myGuildPermissions.includes(p));
  }, [activeGuild, me]);
  const activeGuildCanManageChannels = useMemo(() => {
    if (!activeGuild || !me) return false;
    if (activeGuild.ownerId === me.id) return true;
    const defaultRole = activeGuild.roles?.find(r => r.id === "default") || { id: "default", permissions: ["SEND_MESSAGES"] };
    const baseGuildPerms = [
      ...(defaultRole.permissions || []),
      ...((activeGuild.memberRoles || {})[me.id]?.flatMap(rid => activeGuild.roles?.find(r => r.id === rid)?.permissions || []) || [])
    ];
    const myGuildPermissions = [...baseGuildPerms, ...(me.role?.toUpperCase() === "DEVELOPER" ? ["ADMINISTRATOR"] : [])];
    return ["ADMINISTRATOR", "MANAGE_CHANNELS"].some(p => myGuildPermissions.includes(p));
  }, [activeGuild, me]);
  const LenslyDmOtherUsername = useMemo(() => {
    if (!activeChannelId?.startsWith("dm_") || !me?.username) return null;
    const parts = activeChannelId.replace("dm_", "").split("_");
    const other = parts.find((u) => u !== me.username);
    return other ?? null;
  }, [activeChannelId, me?.username]);
  const isLenslyDm = LenslyDmOtherUsername?.toLowerCase() === "lensly" || LenslyDmOtherUsername?.toLowerCase() === "lensly_system";

  // Reset server discovery application form on active guild change
  useEffect(() => {
    setShowDiscoveryForm(false);
    setDiscoveryWhyJoin("");
    setDiscoveryMemberCount("");
    setDiscoveryCategory("Social");
    setDiscoveryGuidelines("");
  }, [activeGuildId]);

  // ──────────────────────────────────────────────────────────────────────────
  // ── Effects
  // ──────────────────────────────────────────────────────────────────────────

  // Save DMs
  useEffect(() => { try { localStorage.setItem("Lensly_local_dms", JSON.stringify(localDMs)); } catch {} }, [localDMs]);

  // Listen to active DM channels
  useEffect(() => {
    if (!me?.id) return;
    const q = query(collection(db, "dm_channels"), where("participants", "array-contains", me.id));
    const unsub = onSnapshot(q, (snap) => {
      const activeDmUsernames: string[] = [];
      snap.forEach(d => {
        const data = d.data();
        const otherUsername = data.participantUsernames?.find((u: string) => u !== me.username);
        if (otherUsername) activeDmUsernames.push(otherUsername);
      });
      if (activeDmUsernames.length > 0) {
        setLocalDMs(prev => {
          const merged = Array.from(new Set([...prev, ...activeDmUsernames]));
          if (merged.length !== prev.length) return merged;
          return prev;
        });
      }
    });
    return () => unsub();
  }, [me?.id, me?.username]);
  // Save voice settings
  useEffect(() => { localStorage.setItem("gc_ptt", pttEnabled ? "1" : "0"); }, [pttEnabled]);
  useEffect(() => { localStorage.setItem("gc_noise", noiseSuppress ? "1" : "0"); }, [noiseSuppress]);
  useEffect(() => { localStorage.setItem("gc_quality", streamQuality); }, [streamQuality]);

  // Load all users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const loaded: UserType[] = [];
      snap.forEach((d) => {
        const data = d.data();
        loaded.push({
          id: d.id, username: data.username || "", displayName: data.displayName || null,
          avatarUrl: data.avatarUrl || null, presenceStatus: data.presenceStatus || "OFFLINE",
          statusLine: data.statusLine || null, bio: data.bio || null,
          userBadges: data.userBadges || [], friends: data.friends || [],
          blockedUsers: data.blockedUsers || [],
        });
      });
      setAllUsers(loaded);
    });
    return () => unsub();
  }, []);

  // Sync my data from allUsers
  useEffect(() => {
    if (!me?.id) return;
    const myData = allUsers.find(u => u.id === me.id);
    if (myData) {
      setMyFriends(myData.friends || []);
      setBlockedUsers(myData.blockedUsers || []);
    }
  }, [allUsers, me?.id]);

  // Load my friend requests
  useEffect(() => {
    if (!me?.id) return;
    const q = collection(db, `users/${me.id}/friendRequests`);
    const unsub = onSnapshot(q, (snap) => {
      const reqs: FriendRequest[] = [];
      snap.forEach(d => reqs.push(d.data() as FriendRequest));
      setFriendRequests(reqs);
    });
    return () => unsub();
  }, [me?.id]);

  // Load guilds
  useEffect(() => {
    if (!me?.id) return;
    const q = query(collection(db, "guilds"), where("members", "array-contains", me.id));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Guild[] = [];
      snap.forEach(d => loaded.push({ id: d.id, ...d.data() } as Guild));
      setGuilds(loaded);
    });
    return () => unsub();
  }, [me?.id]);

  // Auto-select first guild
  useEffect(() => {
    if (!guilds.length || hasSelectedInitial.current) return;
    hasSelectedInitial.current = true;
    const first = guilds[0];
    setActiveGuildId(first.id);
    const ch = first.channels?.find((c) => c.type === "TEXT") ?? first.channels?.[0];
    if (ch) setActiveChannelId(ch.id);
  }, [guilds]);

  // Load messages
  useEffect(() => {
    if (!activeChannelId) return;
    setMessages([]);
    const q = query(collection(db, `channels/${activeChannelId}/messages`), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Message[] = [];
      let incomingMsg: any = null;

      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.author && data.author.id !== me?.id && !snap.metadata.hasPendingWrites) {
            incomingMsg = data;
          }
        }
      });

      snap.forEach(d => {
        const data = d.data();
        loaded.push({
          id: d.id, content: data.content,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          editedAt: data.editedAt?.toDate?.()?.toISOString(),
          editedContent: data.editedContent,
          replyTo: data.replyTo,
          attachments: data.attachments || [],
          reactions: data.reactions || {},
          pinnedBy: data.pinnedBy, pinnedAt: data.pinnedAt,
          author: data.author,
        });
      });
      setMessages(loaded);
      // Build pinned list
      setPinnedMessages(loaded.filter(m => m.pinnedBy));

      if (incomingMsg) {
        const isMuted = (prefs.mutedGuildIds ?? []).includes(activeGuildId ?? "");
        if (prefs.soundEnabled && !prefs.dndEnabled && !isMuted) {
          const isMention = incomingMsg.content?.includes(`@${me?.username}`) || incomingMsg.content?.includes(`@${me?.displayName}`);
          const isDm = !activeGuildId;
          const master = prefs.masterVolume ?? 0.8;
          if (isDm) {
            playNotificationSound(prefs.dmSound || "chime", (prefs.dmVolume ?? 0.8) * master);
          } else if (isMention) {
            playNotificationSound(prefs.mentionSound || "alert", (prefs.mentionVolume ?? 1.0) * master);
          } else {
            playNotificationSound(prefs.serverSound || "chime", (prefs.serverVolume ?? 0.6) * master);
          }
        }
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(incomingMsg.author.displayName ?? incomingMsg.author.username, {
              body: incomingMsg.content,
              tag: "Lensly-msg",
            });
          } catch (err) {
            console.warn("Failed to create notification:", err);
          }
        }
      }
    }, (err) => {
      console.error(`Error loading messages for channel ${activeChannelId}:`, err);
    });
    return () => unsub();
  }, [activeChannelId, prefs.soundEnabled, prefs.notificationSound, me?.id]);

  // Request notifications permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  // Typing indicator listener
  useEffect(() => {
    if (!activeChannelId) return;
    const q = collection(db, `typing/${activeChannelId}/typists`);
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const active: { id: string; username: string }[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (d.id !== me?.id && data.expiresAt && data.expiresAt > now) {
          active.push({ id: d.id, username: data.username });
        }
      });
      setTypingUsers(active);
    });
    return () => unsub();
  }, [activeChannelId, me?.id]);

  // Listen to VC users in active voice channel
  useEffect(() => {
    isFirstVcSnapshotRef.current = true;
    prevVcUsersRef.current = [];
  }, [activeVcChannelId]);

  useEffect(() => {
    if (!activeVcChannelId) { setVcUsers([]); return; }
    const q = collection(db, `voiceChannels/${activeVcChannelId}/users`);
    const unsub = onSnapshot(q, (snap) => {
      const users: typeof vcUsers = [];
      snap.forEach(d => users.push(d.data() as any));
      
      const currentIds = users.map(u => u.id);
      
      if (!isFirstVcSnapshotRef.current) {
        const newJoins = currentIds.filter(id => !prevVcUsersRef.current.includes(id));
        const leaves = prevVcUsersRef.current.filter(id => !currentIds.includes(id));
        if (newJoins.length > 0) {
          playJoinSound();
        } else if (leaves.length > 0) {
          playLeaveSound();
        }
      } else {
        isFirstVcSnapshotRef.current = false;
      }
      
      prevVcUsersRef.current = currentIds;
      setVcUsers(users);
    });
    return () => unsub();
  }, [activeVcChannelId]);

  // Listen to all voice channels in the active guild
  useEffect(() => {
    if (!activeGuild?.id) {
      setVcState({});
      return;
    }
    const voiceChannels = activeGuild.channels?.filter(c => c.type === "VOICE") || [];
    const unsubs = voiceChannels.map(vc => {
      const q = collection(db, `voiceChannels/${vc.id}/users`);
      return onSnapshot(q, (snap) => {
        const users: any[] = [];
        snap.forEach(d => users.push(d.data()));
        setVcState(prev => ({ ...prev, [vc.id]: users }));
      });
    });
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [activeGuild?.id, activeGuild?.channels]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Call timer
  useEffect(() => {
    if (!inCall) { setCallSeconds(0); return; }
    const iv = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [inCall]);

  const callTime = `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`;

  // PTT keyboard listeners
  useEffect(() => {
    if (!pttEnabled) return;
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat) setPttHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setPttHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [pttEnabled]);

  // Close menus on click outside
  useEffect(() => {
    const handler = () => { setShowPresenceMenu(false); setContextMenu(null); setServerContextMenu(null); setMemberContextMenu(null); setShowEmojiPicker(false); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // ── Handlers
  // ──────────────────────────────────────────────────────────────────────────

  async function sendTypingIndicator() {
    if (!me || !activeChannelId || isTypingRef.current) return;
    isTypingRef.current = true;
    await setDoc(doc(db, `typing/${activeChannelId}/typists`, me.id), {
      username: me.displayName ?? me.username, expiresAt: Date.now() + 4000,
    }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      isTypingRef.current = false;
      await deleteDoc(doc(db, `typing/${activeChannelId}/typists`, me.id)).catch(() => {});
    }, 3500);
  }

  function autoGrow(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    e.target.style.height = "22px";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
    void sendTypingIndicator();
  }

  function checkVerificationRequirements(): { restricted: boolean; reason: string } {
    if (!activeGuild || !me) return { restricted: false, reason: "" };
    if (activeGuild.ownerId === me.id) return { restricted: false, reason: "" };
    
    // Raid Protection System check
    if (activeGuild.raidProtection) {
      const userRoles = (activeGuild.memberRoles || {})[me.id] || [];
      const isMod = me.role && ["TRIAL_MODERATOR","MODERATOR","ADMIN","MANAGER","DEVELOPER","CO_OWNER","OWNER"].includes(me.role);
      if (userRoles.length === 0 && !isMod) {
        return { restricted: true, reason: "Raid Protection Mode is active. New users without assigned roles are temporarily restricted from sending messages." };
      }
    }

    const level = activeGuild.verificationLevel || "NONE";
    
    if (level === "LOW") {
      if (me.emailVerified === false) {
        return { restricted: true, reason: "Your email must be verified to speak in this server." };
      }
    }
    
    if (level === "MEDIUM") {
      const regTime = me.createdAt ? new Date(me.createdAt).getTime() : Date.now();
      const minsDiff = (Date.now() - regTime) / (1000 * 60);
      if (minsDiff < 5) {
        return { restricted: true, reason: "You must be registered on Lensly for at least 5 minutes to speak in this server." };
      }
    }
    
    if (level === "HIGH") {
      const joinKey = `gc_joined_at_${activeGuild.id}`;
      let joinTime = localStorage.getItem(joinKey);
      if (!joinTime) {
        joinTime = new Date().toISOString();
        localStorage.setItem(joinKey, joinTime);
      }
      const minsDiff = (Date.now() - new Date(joinTime).getTime()) / (1000 * 60);
      if (minsDiff < 10) {
        const remaining = Math.ceil(10 - minsDiff);
        return { restricted: true, reason: `You must be a member of this server for at least 10 minutes to speak. Please wait ${remaining} more minute(s).` };
      }
    }
    
    return { restricted: false, reason: "" };
  }

  function runAutoMod(content: string): { blocked: boolean; reason: string } {
    if (!activeGuild || activeGuild.autoModEnabled === false) return { blocked: false, reason: "" };

    const clean = content.toLowerCase();

    // 1. Scam Check
    if (activeGuild.autoModScam !== false) {
      const scamKeywords = ["free nitro", "steam promo", "gift card code", "earn money fast", "get free coins", "t.me/Lensly", "discord-gift", "nitro gift", "cashapp hack"];
      for (const keyword of scamKeywords) {
        if (clean.includes(keyword)) {
          return { blocked: true, reason: `Scam link or phishing content detected ("${keyword}")` };
        }
      }
    }

    // 2. Vulgarity/Profanity Check
    if (activeGuild.autoModVulgar !== false) {
      const vulgarWords = ["fuck", "shit", "bitch", "asshole", "crap", "bastard", "dick", "cunt", "nigger", "faggot"];
      for (const word of vulgarWords) {
        if (clean.includes(word)) {
          return { blocked: true, reason: `Profanity/offensive language detected ("${word}")` };
        }
      }
    }

    // 3. Spam Check (rapid duplicate messages)
    if (activeGuild.autoModSpam !== false) {
      const tenSecsAgo = Date.now() - 10000;
      const recentUserMsgs = messages.filter(m => m.author.id === me?.id && new Date(m.createdAt).getTime() > tenSecsAgo);
      if (recentUserMsgs.length >= 3) {
        return { blocked: true, reason: "Spam detected (rate limit exceeded: 3 messages per 10 seconds)" };
      }
      
      const sixtySecsAgo = Date.now() - 60000;
      const duplicateMsg = messages.find(m => m.author.id === me?.id && m.content === content && new Date(m.createdAt).getTime() > sixtySecsAgo);
      if (duplicateMsg) {
        return { blocked: true, reason: "Spam detected (duplicate message sent in last 60 seconds)" };
      }
    }

    return { blocked: false, reason: "" };
  }

  async function sendMessage() {
    if (!draft.trim() || !me || !activeChannelId) return;

    if (isLenslyDm) {
      alert("This is the official Lensly account. You cannot chat with this account.");
      return;
    }

    // Security & Verification Checks
    const verifyCheck = checkVerificationRequirements();
    if (verifyCheck.restricted) {
      alert(`🔒 Server Security: ${verifyCheck.reason}`);
      return;
    }

    const body = draft.trim();

    // AutoMod Checks
    const automodCheck = runAutoMod(body);
    if (automodCheck.blocked) {
      alert(`🤖 AutoMod Blocked: ${automodCheck.reason}`);
      if (activeGuild) {
        await addDoc(collection(db, `guilds/${activeGuild.id}/moderationLogs`), {
          type: "AUTOMOD_BLOCK",
          timestamp: new Date().toISOString(),
          userId: me.id,
          username: me.username,
          displayName: me.displayName || me.username,
          content: body,
          reason: automodCheck.reason,
        });
      }
      return;
    }

    setDraft("");
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "22px";
    isTypingRef.current = false;
    await deleteDoc(doc(db, `typing/${activeChannelId}/typists`, me.id)).catch(() => {});

    const msgData: any = {
      content: body, createdAt: serverTimestamp(),
      author: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl, badges: me.userBadges },
      reactions: {},
    };
    if (replyingTo) {
      msgData.replyTo = { id: replyingTo.id, content: replyingTo.content.slice(0, 80), authorName: replyingTo.author.displayName ?? replyingTo.author.username };
    }
    try {
      await addDoc(collection(db, `channels/${activeChannelId}/messages`), msgData);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      alert(`🔒 Failed to send message: ${err.message || String(err)}`);
      setDraft(body);
      return;
    }

    if (activeChannelId.startsWith("dm_")) {
      const parts = activeChannelId.replace("dm_", "").split("_");
      const otherUsername = parts.find(u => u !== me.username);
      if (otherUsername) {
        await ensureDmChannel(otherUsername);
      }
    }
  }

  async function sendReaction(messageId: string, emoji: string) {
    if (!me || !activeChannelId) return;
    const msgRef = doc(db, `channels/${activeChannelId}/messages`, messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = msgSnap.data().reactions || {};
    const users: string[] = reactions[emoji] || [];
    const newUsers = users.includes(me.id) ? users.filter(u => u !== me.id) : [...users, me.id];
    const newReactions = { ...reactions, [emoji]: newUsers };
    if (newUsers.length === 0) delete newReactions[emoji];
    await updateDoc(msgRef, { reactions: newReactions });
  }

  async function pinMessage(message: Message) {
    if (!me || !activeChannelId) return;
    const msgRef = doc(db, `channels/${activeChannelId}/messages`, message.id);
    if (message.pinnedBy) {
      await updateDoc(msgRef, { pinnedBy: null, pinnedAt: null });
    } else {
      await updateDoc(msgRef, { pinnedBy: me.id, pinnedAt: new Date().toISOString() });
    }
  }

  async function startEditMessage(msg: Message) {
    setEditingMessageId(msg.id);
    setEditContent(msg.editedContent ?? msg.content);
    setContextMenu(null);
  }

  async function submitEdit() {
    if (!editingMessageId || !activeChannelId || !editContent.trim()) { setEditingMessageId(null); return; }
    await updateDoc(doc(db, `channels/${activeChannelId}/messages`, editingMessageId), {
      editedContent: editContent.trim(), editedAt: serverTimestamp(),
    });
    setEditingMessageId(null);
    setEditContent("");
  }

  async function deleteMessage(message: Message) {
    if (!activeChannelId) return;
    // Log to modLogs if in a guild
    if (activeGuildId) {
      await addDoc(collection(db, `modLogs/${activeGuildId}/deletedMessages`), {
        messageId: message.id, originalContent: message.content,
        authorId: message.author.id, authorUsername: message.author.username,
        deletedBy: me?.id, deletedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    await deleteDoc(doc(db, `channels/${activeChannelId}/messages`, message.id)).catch(console.error);
    setContextMenu(null);
  }

  async function createGuild() {
    if (!me || !newGuildName.trim()) return;
    const channels = selectedTemplate.channels.length > 0
      ? selectedTemplate.channels.map(c => ({ ...c, id: Math.random().toString(36).substring(2, 9) }))
      : [{ id: Math.random().toString(36).substring(2, 9), name: "general", type: "TEXT" }];

    await addDoc(collection(db, "guilds"), {
      name: newGuildName.trim(), ownerId: me.id, suspended: false,
      members: [me.id], channels, boostCount: 0, isPublic: false,
    });
    setNewGuildName(""); setShowNewServer(false);
  }

  async function joinGuild() {
    if (!me || !inviteId.trim()) return;
    let targetId = inviteId.trim();
    if (targetId.includes("/invite/")) targetId = targetId.split("/invite/").pop() || "";
    targetId = targetId.trim();
    if (!targetId) return;
    try {
      const guildDocRef = doc(db, "guilds", targetId);
      const guildDoc = await getDoc(guildDocRef);
      if (!guildDoc.exists()) { alert("Invalid invite link or Server ID."); return; }
      const data = guildDoc.data();
      if (data?.suspended) { alert("This server is suspended."); return; }
      if ((data?.members || []).includes(me.id)) {
        alert("You are already a member!"); setInviteId(""); setShowNewServer(false); setActiveGuildId(targetId); return;
      }
      await updateDoc(guildDocRef, { members: arrayUnion(me.id) });
      // No system message on join — seamless
      alert(`Joined "${data?.name}"!`);
      setInviteId(""); setShowNewServer(false); setActiveGuildId(targetId);
    } catch (err) { alert("Failed to join: " + String(err)); }
  }

  async function joinFromDiscovery(guild: Guild) {
    if (!me) return;
    if ((guild.members || []).includes(me.id)) { setShowDiscovery(false); setActiveGuildId(guild.id); return; }
    await updateDoc(doc(db, "guilds", guild.id), { members: arrayUnion(me.id) });
    setShowDiscovery(false); setActiveGuildId(guild.id);
    alert(`Joined "${guild.name}"!`);
  }

  async function transferOwnership(guildId: string, targetUserId: string, targetUserName: string) {
    if (!me || !activeGuild || activeGuild.ownerId !== me.id) return;
    if (!confirm(`Are you sure you want to transfer ownership of this server to ${targetUserName}? This action cannot be undone.`)) return;
    const guildRef = doc(db, "guilds", guildId);
    await updateDoc(guildRef, { ownerId: targetUserId });
  }

  async function kickMember(guildId: string, userId: string, userName: string) {
    if (!me) return;
    if (!confirm(`Are you sure you want to kick ${userName} from the server?`)) return;
    const guildRef = doc(db, "guilds", guildId);
    const snap = await getDoc(guildRef);
    if (!snap.exists()) return;
    const members: string[] = snap.data().members || [];
    await updateDoc(guildRef, { members: members.filter(id => id !== userId) });
  }

  async function leaveServer(guildId: string, guildName: string) {
    if (!me) return;
    if (!confirm(`Are you sure you want to leave "${guildName}"?`)) return;
    const guildRef = doc(db, "guilds", guildId);
    const snap = await getDoc(guildRef);
    if (!snap.exists()) return;
    const members: string[] = snap.data().members || [];
    await updateDoc(guildRef, { members: members.filter(id => id !== me.id) });
    if (activeGuildId === guildId) setActiveGuildId(null);
    setServerContextMenu(null);
    setShowServerSettings(false);
  }

  async function loadPublicGuilds() {
    const q = query(collection(db, "guilds"), where("isPublic", "==", true), limit(30));
    const snap = await getDocs(q);
    const loaded: Guild[] = [];
    snap.forEach(d => loaded.push({ id: d.id, ...d.data() } as Guild));
    setPublicGuilds(loaded);
  }

  async function boostServer() {
    if (!me || !activeGuild) return;
    if (!showBoostCheckout) {
      setCheckoutCard("");
      setCheckoutExpiry("");
      setCheckoutCvv("");
      setCheckoutName(me.displayName || me.username);
      setShowBoostCheckout(true);
      return;
    }

    if (!checkoutCard.trim() || !checkoutExpiry.trim() || !checkoutCvv.trim()) {
      alert("Please fill in all payment details.");
      return;
    }

    alert(`💳 Stripe Payment Gateway Integration Coming Soon!\n\nServer boosting is a premium feature costing $4.99 per boost. Real-money billing is currently being finalized and is not yet active.\n\nThank you for your patience!`);
    setShowBoostCheckout(false);
    setShowBoostModal(false);
  }

  async function joinVoiceChannel(channelId: string) {
    if (!me) return;
    // Leave previous VC first
    if (activeVcChannelId) await leaveVoiceChannel();

    playJoinSound();

    // Get microphone first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: noiseSuppress, echoCancellation: true, autoGainControl: true }
      });
      audioStreamRef.current = stream;
      if (isMuted) stream.getAudioTracks().forEach(t => t.enabled = false);

      // Start monitoring our own microphone
      monitorStream(me.id, stream);
    } catch (err) {
      console.warn("Microphone access denied or failed:", err);
    }

    setActiveVcChannelId(channelId);
    setInCall(true);
    setShowVcPanel(true);

    // Join VC user list after stream is acquired
    await setDoc(doc(db, `voiceChannels/${channelId}/users`, me.id), {
      id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl,
      joinedAt: new Date().toISOString(),
    }).catch(() => {});
    // No system message sent — seamless join
  }

  async function leaveVoiceChannel() {
    if (!me || !activeVcChannelId) return;
    playLeaveSound();
    await deleteDoc(doc(db, `voiceChannels/${activeVcChannelId}/users`, me.id)).catch(() => {});
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    setInCall(false);
    setActiveVcChannelId(null);
    setShowVcPanel(false);
    setVcUsers([]);
    cleanupWebAudio();
  }

  async function startScreenShare() {
    const qualityMap = { LOW: { width: 1280, height: 720, frameRate: 15 }, MED: { width: 1920, height: 1080, frameRate: 24 }, HIGH: { width: 1920, height: 1080, frameRate: 60 } };
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: qualityMap[streamQuality], audio: true });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      stream.getVideoTracks()[0].onended = () => { setIsScreenSharing(false); screenStreamRef.current = null; };
    } catch { /* user cancelled */ }
  }

  function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }

  function toggleMute() {
    setIsMuted(m => {
      const next = !m;
      audioStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !next);
      return next;
    });
  }

  async function updatePresence(p: Presence) {
    setPresence(p); setShowPresenceMenu(false);
    if (!me) return;
    await updateDoc(doc(db, "users", me.id), { presenceStatus: p });
  }

  async function saveCustomStatus() {
    if (!me) return;
    setCustomStatus(statusDraft);
    setShowStatusEdit(false);
    await updateDoc(doc(db, "users", me.id), { statusLine: statusDraft });
  }

  async function sendFriendRequest(targetUser: UserType) {
    if (!me || targetUser.id === me.id) return;
    if (myFriends.includes(targetUser.id)) { alert("Already friends!"); return; }
    try {
      await setDoc(doc(db, `users/${targetUser.id}/friendRequests`, me.id), {
        fromId: me.id,
        fromUsername: me.username,
        fromDisplayName: me.displayName,
        fromAvatarUrl: me.avatarUrl,
        sentAt: new Date().toISOString(),
      });
      alert(`Friend request sent to @${targetUser.username}!`);
    } catch (err) {
      console.error("Failed to send friend request:", err);
      alert(`Failed to send friend request: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function ensureDmChannel(otherUsername: string) {
    if (!me) return;
    const otherUser = allUsers.find(u => u.username === otherUsername);
    if (!otherUser) return;
    const dmId = "dm_" + [me.username, otherUsername].sort().join("_");
    await setDoc(doc(db, "dm_channels", dmId), {
      id: dmId,
      participants: [me.id, otherUser.id],
      participantUsernames: [me.username, otherUsername],
      lastMessageAt: new Date().toISOString()
    }, { merge: true });
  }
  async function acceptFriendRequest(req: FriendRequest) {
    if (!me) return;
    await updateDoc(doc(db, "users", me.id), { friends: arrayUnion(req.fromId) });
    await updateDoc(doc(db, "users", req.fromId), { friends: arrayUnion(me.id) });
    await deleteDoc(doc(db, `users/${me.id}/friendRequests`, req.fromId));
    alert(`You are now friends with @${req.fromUsername}!`);
  }

  async function declineFriendRequest(req: FriendRequest) {
    if (!me) return;
    await deleteDoc(doc(db, `users/${me.id}/friendRequests`, req.fromId));
  }

  async function removeFriend(userId: string) {
    if (!me) return;
    const myRef = doc(db, "users", me.id);
    const mySnap = await getDoc(myRef);
    const myFriendsArr: string[] = mySnap.data()?.friends || [];
    await updateDoc(myRef, { friends: myFriendsArr.filter(f => f !== userId) });
    const theirRef = doc(db, "users", userId);
    const theirSnap = await getDoc(theirRef);
    const theirFriends: string[] = theirSnap.data()?.friends || [];
    await updateDoc(theirRef, { friends: theirFriends.filter(f => f !== me.id) });
  }

  async function blockUser(targetId: string) {
    if (!me) return;
    await updateDoc(doc(db, "users", me.id), { blockedUsers: arrayUnion(targetId) });
    setSelectedUserProfile(null);
    alert("User blocked.");
  }

  async function unblockUser(targetId: string) {
    if (!me) return;
    const userSnap = await getDoc(doc(db, "users", me.id));
    const blocked: string[] = userSnap.data()?.blockedUsers || [];
    await updateDoc(doc(db, "users", me.id), { blockedUsers: blocked.filter(b => b !== targetId) });
  }

  async function createGroupDm() {
    if (!me || groupDmSelected.length < 2 || !groupDmName.trim()) return;
    const participants = [...groupDmSelected, me.id];
    const channelId = "gdm_" + Math.random().toString(36).substring(2, 9);
    await setDoc(doc(db, "groupDms", channelId), {
      id: channelId, name: groupDmName.trim(), participants,
      createdBy: me.id, createdAt: new Date().toISOString(),
    });
    setActiveGuildId(null);
    setActiveChannelId(channelId);
    setShowGroupDmModal(false);
    setGroupDmName("");
    setGroupDmSelected([]);
  }

  async function createChannel() {
    if (!me || !newChannelName.trim() || !activeGuildId || !activeGuildCanManageChannels) return;
    const newId = Math.random().toString(36).substring(2, 9);
    const newChan: any = { id: newId, name: newChannelName.trim().toLowerCase(), type: newChannelType };
    if (newChannelType !== "CATEGORY" && selectedCategoryId) newChan.categoryId = selectedCategoryId;
    await updateDoc(doc(db, "guilds", activeGuildId), { channels: arrayUnion(newChan) });
    setNewChannelName(""); setNewChannelType("TEXT"); setSelectedCategoryId(""); setShowNewChannel(false);
  }

  async function deleteChannel(channelId: string) {
    if (!activeGuild || !activeGuildCanManageChannels) return;
    if (!confirm("Delete this channel?")) return;
    const updated = activeGuild.channels.filter(c => c.id !== channelId);
    await updateDoc(doc(db, "guilds", activeGuild.id), { channels: updated });
    if (activeChannelId === channelId) setActiveChannelId(updated.find(c => c.type === "TEXT")?.id ?? null);
  }

  async function moveChannel(channelId: string, dir: "UP" | "DOWN") {
    if (!activeGuild || !activeGuildCanManageChannels) return;
    const chs = [...activeGuild.channels];
    const i = chs.findIndex(c => c.id === channelId);
    const ti = dir === "UP" ? i - 1 : i + 1;
    if (ti < 0 || ti >= chs.length) return;
    [chs[i], chs[ti]] = [chs[ti], chs[i]];
    await updateDoc(doc(db, "guilds", activeGuild.id), { channels: chs });
  }

  async function addServerRole() {
    if (!activeGuild || !newRoleName.trim()) return;
    const newRole: RoleType = { id: Math.random().toString(36).substring(2, 9), name: newRoleName.trim(), color: newRoleColor, permissions: ["SEND_MESSAGES"] };
    const base = (activeGuild.roles || []).some(r => r.id === "default") ? (activeGuild.roles || []) : [{ id: "default", name: "@everyone", color: "#9ca3af", permissions: ["SEND_MESSAGES"] }, ...(activeGuild.roles || [])];
    await updateDoc(doc(db, "guilds", activeGuild.id), { roles: [...base, newRole] });
    setNewRoleName("");
  }

  async function deleteServerRole(roleId: string) {
    if (!activeGuild || !confirm("Delete this role?")) return;
    const base = (activeGuild.roles || []).some(r => r.id === "default") ? (activeGuild.roles || []) : [{ id: "default", name: "@everyone", color: "#9ca3af", permissions: ["SEND_MESSAGES"] }, ...(activeGuild.roles || [])];
    const updatedRoles = base.filter(r => r.id !== roleId);
    const updatedMemberRoles = { ...(activeGuild.memberRoles || {}) };
    Object.keys(updatedMemberRoles).forEach(uid => { updatedMemberRoles[uid] = (updatedMemberRoles[uid] || []).filter(id => id !== roleId); });
    await updateDoc(doc(db, "guilds", activeGuild.id), { roles: updatedRoles, memberRoles: updatedMemberRoles });
    if (selectedRoleId === roleId) setSelectedRoleId(null);
  }

  async function toggleRolePerm(roleId: string, perm: string) {
    if (!activeGuild) return;
    const base = (activeGuild.roles || []).some(r => r.id === "default") ? (activeGuild.roles || []) : [{ id: "default", name: "@everyone", color: "#9ca3af", permissions: ["SEND_MESSAGES"] }, ...(activeGuild.roles || [])];
    const updatedRoles = base.map(r => {
      if (r.id !== roleId) return r;
      const permissions = r.permissions || [];
      const has = permissions.includes(perm);
      return { ...r, permissions: has ? permissions.filter(p => p !== perm) : [...permissions, perm] };
    });
    await updateDoc(doc(db, "guilds", activeGuild.id), { roles: updatedRoles });
  }

  async function updateRoleProperties(roleId: string, updates: Partial<RoleType>) {
    if (!activeGuild) return;
    const base = (activeGuild.roles || []).some(r => r.id === "default") ? (activeGuild.roles || []) : [{ id: "default", name: "@everyone", color: "#9ca3af", permissions: ["SEND_MESSAGES"] }, ...(activeGuild.roles || [])];
    const updatedRoles = base.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, ...updates };
    });
    await updateDoc(doc(db, "guilds", activeGuild.id), { roles: updatedRoles });
  }

  async function toggleUserRole(userId: string, roleId: string) {
    if (!activeGuild) return;
    const cur = activeGuild.memberRoles || {};
    const userRoles = cur[userId] || [];
    const updated = { ...cur, [userId]: userRoles.includes(roleId) ? userRoles.filter(id => id !== roleId) : [...userRoles, roleId] };
    await updateDoc(doc(db, "guilds", activeGuild.id), { memberRoles: updated });
  }

  async function handleReportMessage() {
    if (!reportingMessage || !reportReason) return alert("Please select a reason.");
    await addDoc(collection(db, "reports"), {
      reporterId: me?.id, reportedId: reportingMessage.author.id,
      messageId: reportingMessage.id, messageContent: reportingMessage.content,
      reason: reportReason, status: "PENDING", createdAt: new Date().toISOString(),
    });
    alert("Report submitted!"); setReportingMessage(null); setReportReason(""); setContextMenu(null);
  }

  async function handleReportServer() {
    if (!reportingGuild || !reportReason) return alert("Please select a reason.");
    await addDoc(collection(db, "reports"), {
      reporterId: me?.id,
      reportedId: reportingGuild.id,
      reportedType: "SERVER",
      guildId: reportingGuild.id,
      guildName: reportingGuild.name,
      reason: reportReason,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    alert("Server report submitted successfully!");
    setReportingGuild(null);
    setReportReason("");
    setServerContextMenu(null);
  }

  // ── Upload attachment
  async function handleFileUpload(file: File) {
    if (!me || !activeChannelId) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    // Store as base64 in message (no Firebase Storage needed)
    const reader = new FileReader();
    reader.onloadend = async () => {
      const url = reader.result as string;
      await addDoc(collection(db, `channels/${activeChannelId}/messages`), {
        content: `📎 ${file.name}`, createdAt: serverTimestamp(),
        author: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl, badges: me.userBadges },
        reactions: {},
        attachments: [{ url, name: file.name, type: isImage ? "image" : isVideo ? "video" : "file" }],
      });
    };
    reader.readAsDataURL(file);
  }

  // ── Derived
  const boostLevel = useMemo(() => BOOST_PERKS.reduce((acc, p) => ((activeGuild?.boostCount ?? 0) >= p.count ? p : acc), BOOST_PERKS[0]), [activeGuild]);

  // ── Suspended guild guard
  if (activeGuild?.suspended) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Server Suspended</div>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>This server was taken down by moderation.</div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ── Render helpers
  // ──────────────────────────────────────────────────────────────────────────
  const renderMessage = (m: Message, i: number) => {
    const prev = messages[i - 1];
    const grouped = prev && prev.author.id === m.author.id && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60 * 1000;
    const isBlocked = blockedUsers.includes(m.author.id);
    if (isBlocked) return <div key={m.id} className="msg-blocked">— blocked message hidden —</div>;
    const isSystemMsg = m.author.id === "Lensly_system" || m.author.badges?.some(b => b.badge?.label === "SYSTEM" || b.badge?.slug === "STAFF");
    let displayContent = m.editedContent ?? m.content;
    if (isSystemMsg && displayContent) {
      displayContent = displayContent
        .replace(/\n\n---\n🛡️ Official Lensly Message/g, "")
        .replace(/\n\n---\n⚠️ Not the official Lensly Message/g, "")
        .replace(/\n\n---\n⚠️ Not the official Lensly message/g, "")
        .replace(/\n\n---\n🛡️ Official Lensly Message/gi, "");
    }
    const isEditing = editingMessageId === m.id;
    const reactionsMap = m.reactions || {};
    const canEdit = m.author.id === me?.id;
    const canDelete = m.author.id === me?.id || (me?.role && ["TRIAL_MODERATOR","MODERATOR","ADMIN","MANAGER","DEVELOPER","CO_OWNER","OWNER"].includes(me.role));

    if (isSystemMsg) {
      return (
        <div key={m.id} className="msg-group system-message-card"
          style={{
            background: "rgba(88, 101, 242, 0.05)",
            border: "1px solid rgba(88, 101, 242, 0.15)",
            borderRadius: "12px",
            padding: "16px",
            margin: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            position: "relative",
            overflow: "hidden"
          }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, message: m }); }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="msg-avatar" style={{ flexShrink: 0 }}>
              <Avatar user={m.author} size={40} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: "14px" }}>
                  {m.author.displayName ?? m.author.username}
                </span>
                <span style={{
                  background: "#5865F2",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px"
                }}>
                  ✓ OFFICIAL
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "2px", fontWeight: 500 }}>
                Official Lensly Message
              </span>
            </div>
            <span className="msg-time" style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
            <div className="msg-text" style={{ fontSize: "14px", color: "#E0E0E0", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
              {displayContent}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={m.id} className={grouped ? "msg-continued" : "msg-group"}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, message: m }); }}>
        {!grouped && (
          <div className="msg-avatar" onClick={() => openUserProfile(m.author.id, m.author)}>
            <Avatar user={m.author} size={40} />
          </div>
        )}
        <div className="msg-content">
          {!grouped && (() => {
            let authorColor = "var(--text)";
            if (activeGuild) {
              const userRoles = (activeGuild.memberRoles || {})[m.author.id] || [];
              const guildRoles = activeGuild.roles || [];
              const matchingRole = guildRoles.find(r => userRoles.includes(r.id) && r.color && r.color !== "transparent");
              if (matchingRole) {
                authorColor = matchingRole.color;
              }
            }
            return (
              <div className="msg-header">
                <span className="msg-name" onClick={() => openUserProfile(m.author.id, m.author)} style={{ color: authorColor }}>
                  {m.author.displayName ?? m.author.username}
                </span>
                <span className="msg-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            );
          })()}

          {/* Reply preview */}
          {m.replyTo && (
            <div className="reply-quote">
              <span className="reply-quote-icon">↱</span>
              <span className="reply-quote-author">{m.replyTo.authorName}</span>
              <span className="reply-quote-text">{m.replyTo.content}</span>
            </div>
          )}

          {/* Message body / edit */}
          {isEditing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <input value={editContent} onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void submitEdit(); if (e.key === "Escape") setEditingMessageId(null); }}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--accent)", color: "#fff", fontSize: 14 }} autoFocus />
              <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={submitEdit}>Save</button>
              <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditingMessageId(null)}>Cancel</button>
            </div>
          ) : (
            <div className="msg-text">
              {displayContent}
              {m.editedAt && <span className="msg-edited">(edited)</span>}
              {m.pinnedBy && <span className="msg-pinned-tag">📌</span>}
            </div>
          )}

          {/* Attachments */}
          {m.attachments && m.attachments.length > 0 && (
            <div className="msg-attachments">
              {m.attachments.map((a, ai) => (
                <div key={ai} className="msg-attachment">
                  {a.type === "image" ? (
                    <img src={a.url} alt={a.name} className="msg-img" onClick={() => window.open(a.url)} />
                  ) : a.type === "video" ? (
                    <video src={a.url} controls className="msg-video" />
                  ) : (
                    <a href={a.url} download={a.name} className="msg-file">📎 {a.name}</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(reactionsMap).length > 0 && (
            <div className="reaction-bar">
              {Object.entries(reactionsMap).map(([emoji, users]) => (
                <button key={emoji} className={`reaction-pill ${(users as string[]).includes(me?.id || "") ? "reacted" : ""}`}
                  onClick={() => void sendReaction(m.id, emoji)}>
                  <span>{emoji}</span>
                  <span className="reaction-count">{(users as string[]).length}</span>
                </button>
              ))}
              <button className="reaction-add-btn" onClick={(e) => { e.stopPropagation(); setEmojiTarget(m.id); setShowEmojiPicker(true); }}>+</button>
            </div>
          )}
          {Object.keys(reactionsMap).length === 0 && !isEditing && (
            <div className="reaction-bar reaction-bar-empty">
              <button className="reaction-add-btn reaction-add-ghost" onClick={(e) => { e.stopPropagation(); setEmojiTarget(m.id); setShowEmojiPicker(true); }}>😊 +</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  function openUserProfile(userId: string, fallbackAuthor?: any) {
    const fullUser = allUsers.find(u => u.id === userId) || (userId === me?.id ? (me as any) : null);
    if (fullUser) { setSelectedUserProfile(fullUser); return; }
    if (fallbackAuthor) setSelectedUserProfile({ id: fallbackAuthor.id, username: fallbackAuthor.username, displayName: fallbackAuthor.displayName, avatarUrl: fallbackAuthor.avatarUrl, presenceStatus: "OFFLINE", userBadges: fallbackAuthor.badges || [] } as any);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ── Main Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      {!isOnline && (
        <div style={{
          background: "linear-gradient(90deg, #F59E0B, #D97706)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          flexShrink: 0
        }}>
          <span>⚠️</span>
          <span>Update waiting for release! The site may refresh soon to apply the latest features.</span>
        </div>
      )}

      {showGlobalUpdateBanner && (
        <div 
          onClick={() => navigate("/update")}
          style={{
            background: "linear-gradient(90deg, #4F7CFF, #8C5EFF)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 9998,
            boxShadow: "0 2px 10px rgba(79,124,255,0.4)",
            flexShrink: 0,
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: 16 }}>🚀</span>
          <span>Waiting for update — A new Lensly system release is coming soon!</span>
        </div>
      )}

      {/* ── VC Panel (floating) */}
      {showVcPanel && inCall && (
        <div className="vc-panel">
          <div className="vc-panel-header">
            <span style={{ fontSize: 12, color: "#34D399", fontWeight: 700 }}>🔊 Voice Connected</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{callTime}</span>
          </div>
          <div className="vc-users">
            {vcUsers.map(u => {
              const isSpeaking = speakingUsers[u.id];
              return (
                <div key={u.id} className="vc-user" style={{
                  border: isSpeaking ? "1.5px solid #34D399" : "1.5px solid transparent",
                  boxShadow: isSpeaking ? "0 0 8px rgba(52,211,153,0.4)" : "none",
                  borderRadius: 6,
                  padding: "4px 8px",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Avatar user={u} size={28} isSpeaking={isSpeaking} />
                  <span style={{ fontSize: 11, color: isSpeaking ? "#34D399" : "var(--text)" }}>
                    {u.displayName ?? u.username}
                  </span>
                </div>
              );
            })}
          </div>
          {isScreenSharing && (
            <div className="vc-screen-badge">🖥️ Screen Sharing</div>
          )}
          <div className="vc-controls">
            <button className={`vc-btn ${isMuted ? "vc-btn-danger" : ""}`} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? "🔇" : "🎙️"}
            </button>
            <button className={`vc-btn ${isDeafened ? "vc-btn-danger" : ""}`} onClick={() => setIsDeafened(!isDeafened)} title="Deafen">
              {isDeafened ? "🔕" : "🔊"}
            </button>
            <button className={`vc-btn ${isScreenSharing ? "vc-btn-active" : ""}`} onClick={() => isScreenSharing ? stopScreenShare() : void startScreenShare()} title="Screen Share">
              🖥️
            </button>
            {pttEnabled && (
              <button className={`vc-btn ${pttHeld ? "vc-btn-active ptt-active" : ""}`} title="Push to Talk (Hold Space)">
                {pttHeld ? "🎤" : "🔴"}
              </button>
            )}
            <button className="vc-btn vc-btn-disconnect" onClick={() => void leaveVoiceChannel()} title="Leave Voice">✕</button>
          </div>
        </div>
      )}

      {/* ── Moderation Alert */}
      {modAlert && (
        <div className="mod-alert">
          <div className="mod-alert-title">⚠️ Moderation Action</div>
          <div className="mod-alert-body">Your message was flagged: <strong>{modAlert.reason}</strong>. Action: {modAlert.action}.</div>
          <div className="mod-alert-actions">
            <button className="btn btn-danger" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setModAlert(null)}>Appeal</button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setModAlert(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* ── PTT Indicator */}
      {pttEnabled && inCall && (
        <div className={`ptt-indicator ${pttHeld ? "ptt-active" : ""}`}>
          {pttHeld ? "🎤 Transmitting" : "🔴 PTT (Hold Space)"}
        </div>
      )}

      {/* ─── Main App Panels Wrapper ─── */}
      <div style={{ display: "flex", flexDirection: "row", flex: 1, width: "100%", height: "100%", overflow: "hidden" }}>
        {/* ─── Server Rail ─── */}
        <aside className="server-rail">
          {/* DMs */}
          <div className={`server-rail-item ${!activeGuildId && !showFriendsPanel ? "active" : ""}`}>
            <div className="server-pill" />
            <div title="Direct Messages" onClick={() => { setShowFriendsPanel(false); setActiveGuildId(null); }}
              className={`server-icon ${!activeGuildId && !showFriendsPanel ? "active" : ""}`}
              style={{ 
                background: !activeGuildId && !showFriendsPanel ? "linear-gradient(135deg,rgba(79,124,255,0.3),rgba(140,94,255,0.2))" : undefined,
                padding: 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
              <img src="/logo.png" alt="Lensly Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>

          {/* Friends */}
          <div className={`server-rail-item ${showFriendsPanel ? "active" : ""}`}>
            <div className="server-pill" />
            <div title="Friends" className={`server-icon ${showFriendsPanel ? "active" : ""}`}
              onClick={() => { setActiveGuildId(null); setShowFriendsPanel(f => !f); }}
              style={{ position: "relative" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sidebar-svg">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {friendRequests.length > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, background: "var(--danger)", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{friendRequests.length}</span>
              )}
            </div>
          </div>

          <div className="server-rail-sep" />

          {guilds.filter(g => {
            const isManagement = me?.role && ["MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());
            if (g.status === "DELETED" && !isManagement) return false;
            if (g.status === "SUSPENDED" && !isManagement) return false;
            return true;
          }).map((g) => {
            const isActive = g.id === activeGuildId && !showFriendsPanel;
            return (
              <div key={g.id} className={`server-rail-item ${isActive ? "active" : ""}`}>
                <div className="server-pill" />
                <div title={g.name + (g.status === "SUSPENDED" ? " (Suspended)" : g.status === "DELETED" ? " (Deleted)" : "")}
                  className={`server-icon ${isActive ? "active" : ""}`}
                  style={{ opacity: g.status === "SUSPENDED" || g.status === "DELETED" ? 0.5 : 1, filter: g.status === "DELETED" ? "grayscale(100%)" : "none" }}
                  onClick={() => { setShowFriendsPanel(false); setActiveGuildId(g.id); const ch = g.channels?.find((c) => c.type === "TEXT") ?? g.channels?.[0]; if (ch) setActiveChannelId(ch.id); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setServerContextMenu({ x: e.clientX, y: e.clientY, guildId: g.id, guildName: g.name });
                  }}>
                  {g.iconUrl ? <img src={g.iconUrl} alt={g.name} /> : g.name.slice(0, 2).toUpperCase()}
                  {(g.boostCount ?? 0) > 0 && <span className="boost-indicator">🚀</span>}
                  {g.status === "SUSPENDED" && <span style={{ position: "absolute", bottom: -2, right: -2, background: "#F59E0B", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>⚠️</span>}
                  {g.status === "DELETED" && <span style={{ position: "absolute", bottom: -2, right: -2, background: "#EF4444", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>❌</span>}
                </div>
              </div>
            );
          })}

          <div className="server-rail-sep" />

          {/* Add Server */}
          <div className="server-rail-item">
            <div className="server-pill" />
            <div className="server-icon add-btn" title="Add Server" onClick={() => setShowNewServer(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>

          {/* Discover */}
          <div className="server-rail-item">
            <div className="server-pill" />
            <div className="server-icon discover-btn" title="Discover Public Servers"
              onClick={() => { void loadPublicGuilds(); setShowDiscovery(true); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </aside>

      {/* ─── Channel Sidebar ─── */}
      <aside className="channel-sidebar">
        <div className="channel-header" style={{ cursor: activeGuild && activeGuildHasAdmin ? "pointer" : "default" }}
          onClick={() => activeGuild && activeGuildHasAdmin && setShowServerSettings(true)}>
          <span>{showFriendsPanel ? "Friends" : activeGuild?.name ?? "Direct Messages"}</span>
          {activeGuild && <span style={{ fontSize: 12 }}>▼</span>}
        </div>

        {activeGuild && activeGuild.bannerUrl && !showFriendsPanel && (
          <div
            style={{
              width: "100%",
              height: 84,
              background: `url(${activeGuild.bannerUrl}) center/cover no-repeat`,
              borderBottom: "1px solid var(--border)",
              position: "relative",
            }}
          />
        )}

        <div className="channel-list">
          {showFriendsPanel ? (
            <>
              <div className="channel-section-label" style={{ display: "flex", gap: 6 }}>
                {(["ALL", "REQUESTS", "BLOCKED"] as const).map(tab => (
                  <button key={tab} onClick={() => setFriendsTab(tab)}
                    style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: friendsTab === tab ? "var(--bg-active)" : "transparent", color: friendsTab === tab ? "var(--text)" : "var(--text-muted)" }}>
                    {tab}{tab === "REQUESTS" && friendRequests.length > 0 ? ` (${friendRequests.length})` : ""}
                  </button>
                ))}
              </div>

              <div style={{ padding: "8px" }}>
                <input placeholder="Search friends..." value={friendSearchQuery} onChange={e => setFriendSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 13 }} />
              </div>

              {friendsTab === "ALL" && (
                <>
                  <div style={{ padding: "4px 8px", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                    All Friends — {myFriends.length}
                  </div>
                  {myFriends.map(fid => {
                    const fu = allUsers.find(u => u.id === fid);
                    if (!fu) return null;
                    if (friendSearchQuery && !fu.username.toLowerCase().includes(friendSearchQuery.toLowerCase())) return null;
                    return (
                      <div key={fid} className="friend-row">
                        <div style={{ position: "relative" }}>
                          <Avatar user={fu} size={32} />
                          <span className="presence-dot-sm" style={{ background: PRESENCE_COLORS[(fu.presenceStatus as Presence) || "OFFLINE"] }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{fu.displayName ?? fu.username}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fu.presenceStatus || "Offline"}</div>
                        </div>
                        <div className="friend-actions">
                          <button title="Message" onClick={() => { void ensureDmChannel(fu.username); setShowFriendsPanel(false); setActiveGuildId(null); setActiveChannelId("dm_" + [me?.username || "", fu.username].sort().join("_")); }}>💬</button>
                          <button title="Remove Friend" onClick={() => void removeFriend(fid)} style={{ color: "var(--danger)" }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {myFriends.length === 0 && <div style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 13 }}>No friends yet — send a request from a user's profile!</div>}
                </>
              )}

              {friendsTab === "REQUESTS" && (
                <>
                  <div style={{ padding: "4px 8px", fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                    Incoming — {friendRequests.length}
                  </div>
                  {friendRequests.map(req => (
                    <div key={req.fromId} className="friend-row">
                      <Avatar user={{ username: req.fromUsername, displayName: req.fromDisplayName, avatarUrl: req.fromAvatarUrl }} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{req.fromDisplayName ?? req.fromUsername}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Wants to be friends</div>
                      </div>
                      <div className="friend-actions">
                        <button title="Accept" onClick={() => void acceptFriendRequest(req)} style={{ color: "var(--success)" }}>✓</button>
                        <button title="Decline" onClick={() => void declineFriendRequest(req)} style={{ color: "var(--danger)" }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {friendRequests.length === 0 && <div style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 13 }}>No pending requests.</div>}
                </>
              )}

              {friendsTab === "BLOCKED" && (
                <>
                  {blockedUsers.map(bid => {
                    const bu = allUsers.find(u => u.id === bid);
                    if (!bu) return null;
                    return (
                      <div key={bid} className="friend-row" style={{ opacity: 0.6 }}>
                        <Avatar user={bu} size={32} />
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{bu.displayName ?? bu.username}</div></div>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => void unblockUser(bid)}>Unblock</button>
                      </div>
                    );
                  })}
                  {blockedUsers.length === 0 && <div style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 13 }}>No blocked users.</div>}
                </>
              )}
            </>
          ) : activeGuild ? (
            <>
              <div className="channel-section-label" style={{ display: "flex", justifyContent: "space-between", paddingRight: 8 }}>
                <span>Channels</span>
                {activeGuildCanManageChannels && (
                  <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }} onClick={() => setShowNewChannel(true)}>+</button>
                )}
              </div>

              {/* Uncategorized channels */}
              {(() => {
                const categories = activeGuild.channels?.filter(c => c.type === "CATEGORY") || [];
                return (activeGuild.channels?.filter(c => c.type !== "CATEGORY" && (!c.categoryId || !categories.some(cat => cat.id === c.categoryId))) || []).map((c) => (
                  <div key={c.id} style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }} className="channel-item-row">
                      <button className={`channel-btn ${c.id === activeChannelId ? "active" : ""}`}
                        onClick={() => c.type === "TEXT" ? setActiveChannelId(c.id) : void joinVoiceChannel(c.id)}
                        style={{ flex: 1 }}>
                        <span className="channel-hash">{c.type === "TEXT" ? "#" : "🔊"}</span>
                        {c.name}

                        {(vcState[c.id] || []).length > 0 && <span style={{ marginLeft: "auto", fontSize: 10, color: "#34D399" }}>●</span>}
                      </button>
                      {activeGuildCanManageChannels && (
                        <div style={{ display: "flex", gap: 4, paddingRight: 8 }}>
                          <button title="Move Up" onClick={() => void moveChannel(c.id, "UP")} style={{ fontSize: 10, color: "var(--text-muted)" }}>▲</button>
                          <button title="Move Down" onClick={() => void moveChannel(c.id, "DOWN")} style={{ fontSize: 10, color: "var(--text-muted)" }}>▼</button>
                          <button title="Delete" onClick={() => void deleteChannel(c.id)} style={{ fontSize: 11, color: "var(--danger)" }}>✕</button>
                        </div>
                      )}
                    </div>
                    {/* Render users in voice channel */}
                    {c.type === "VOICE" && vcState[c.id] && vcState[c.id].length > 0 && (
                      <div style={{ paddingLeft: 24, paddingBottom: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {vcState[c.id].map((user) => {
                          const isSpeaking = speakingUsers[user.id];
                          return (
                            <div key={user.id} style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              color: isSpeaking ? "#34D399" : "var(--text-muted)",
                              fontWeight: isSpeaking ? 600 : "normal",
                              padding: "2px 8px",
                              transition: "all 0.15s ease"
                            }}>
                              <Avatar user={user} size={18} isSpeaking={isSpeaking} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {user.displayName || user.username}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ));
              })()}

              {/* Categories */}
              {(activeGuild.channels?.filter(c => c.type === "CATEGORY") || []).map((cat) => {
                const isCollapsed = collapsedCategories[cat.id];
                const catChannels = activeGuild.channels?.filter(c => c.categoryId === cat.id) || [];
                return (
                  <div key={cat.id} style={{ marginTop: 12 }}>
                    <div className="channel-section-label" style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", paddingRight: 8 }}
                      onClick={() => setCollapsedCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 8 }}>{isCollapsed ? "▶" : "▼"}</span>
                        {cat.name}
                      </span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                        {activeGuildCanManageChannels && (
                          <>
                            <button title="Move Up" onClick={() => void moveChannel(cat.id, "UP")} style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>▲</button>
                            <button title="Move Down" onClick={() => void moveChannel(cat.id, "DOWN")} style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>▼</button>
                            <button style={{ fontSize: 14, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                              onClick={() => { setSelectedCategoryId(cat.id); setNewChannelType("TEXT"); setShowNewChannel(true); }}>+</button>
                            <button title="Delete" onClick={() => void deleteChannel(cat.id)} style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                          </>
                        )}
                      </div>
                    </div>
                    {!isCollapsed && catChannels.map((c) => (
                      <div key={c.id} style={{ display: "flex", flexDirection: "column", paddingLeft: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }} className="channel-item-row">
                          <button className={`channel-btn ${c.id === activeChannelId ? "active" : ""}`}
                            onClick={() => c.type === "TEXT" ? setActiveChannelId(c.id) : void joinVoiceChannel(c.id)} style={{ flex: 1 }}>
                            <span className="channel-hash">{c.type === "TEXT" ? "#" : "🔊"}</span>
                            {c.name}

                            {(vcState[c.id] || []).length > 0 && <span style={{ marginLeft: "auto", fontSize: 10, color: "#34D399" }}>●</span>}
                          </button>
                          {activeGuildCanManageChannels && (
                            <div style={{ display: "flex", gap: 4, paddingRight: 8 }}>
                              <button title="Move Up" onClick={() => void moveChannel(c.id, "UP")} style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer" }}>▲</button>
                              <button title="Move Down" onClick={() => void moveChannel(c.id, "DOWN")} style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer" }}>▼</button>
                              <button title="Delete" onClick={() => void deleteChannel(c.id)} style={{ fontSize: 11, color: "var(--danger)", cursor: "pointer" }}>✕</button>
                            </div>
                          )}
                        </div>
                        {/* Render users in voice channel */}
                        {c.type === "VOICE" && vcState[c.id] && vcState[c.id].length > 0 && (
                          <div style={{ paddingLeft: 20, paddingBottom: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {vcState[c.id].map((user) => {
                              const isSpeaking = speakingUsers[user.id];
                              return (
                                <div key={user.id} style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontSize: 12,
                                  color: isSpeaking ? "#34D399" : "var(--text-muted)",
                                  fontWeight: isSpeaking ? 600 : "normal",
                                  padding: "2px 8px",
                                  transition: "all 0.15s ease"
                                }}>
                                  <Avatar user={user} size={18} isSpeaking={isSpeaking} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.displayName || user.username}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="channel-section-label" style={{ display: "flex", justifyContent: "space-between", paddingRight: 8 }}>
                <span>Direct Messages</span>
                <button title="New Group DM" onClick={() => setShowGroupDmModal(true)} style={{ fontSize: 16, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>+</button>
              </div>
              <div style={{ padding: "8px" }}>
                <input placeholder="Open DM with user..." value={dmUser} onChange={(e) => setDmUser(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 13 }}
                  onKeyDown={async (e) => { if (e.key === "Enter" && dmUser.trim()) { const u = allUsers.find(x => x.username === dmUser.trim()); if (u) { await ensureDmChannel(u.username); setActiveGuildId(null); setActiveChannelId("dm_" + [me?.username || "", u.username].sort().join("_")); } else { alert("User not found."); } setDmUser(""); } }} />
              </div>

              {/* Dedicated Official Lensly Message Channel */}
              {discoveryWorkflowEnabled && (() => {
                const dmId = "dm_" + [me?.username || "", "Lensly"].sort().join("_");
                const isActive = activeChannelId === dmId;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6, marginBottom: 4 }}>
                    <button 
                      className={`channel-btn ${isActive ? "active" : ""}`} 
                      style={{ 
                        flex: 1,
                        background: isActive ? "rgba(88, 101, 242, 0.15)" : "transparent",
                        border: isActive ? "1px solid rgba(88, 101, 242, 0.3)" : "1px solid transparent",
                        borderRadius: "8px",
                        margin: "2px 8px",
                        padding: "6px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s ease"
                      }} 
                      onClick={async () => {
                        const LenslyUser = allUsers.find(u => u.username === "Lensly");
                        if (LenslyUser) {
                          await ensureDmChannel("Lensly");
                        }
                        setActiveGuildId(null);
                        setActiveChannelId(dmId);
                      }}
                    >
                      <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
                        <img src="/logo.png" alt="Lensly" style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          objectFit: "cover",
                          boxShadow: "0 0 8px rgba(79,124,255,0.5)",
                          border: "1px solid rgba(255,255,255,0.12)"
                        }} />
                        <span style={{
                          position: "absolute", bottom: -2, right: -2,
                          width: 9, height: 9, borderRadius: "50%",
                          background: "#10B981", border: "1.5px solid var(--bg-panel)"
                        }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                          Lensly
                          <span style={{
                            background: "linear-gradient(135deg, #34D399, #10B981)",
                            color: "#fff",
                            fontSize: "8px",
                            fontWeight: 800,
                            padding: "1px 4px",
                            borderRadius: "3px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                          }}>
                            ✓ SYSTEM
                          </span>
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>Official Messages</span>
                      </div>
                    </button>
                  </div>
                );
              })()}

              {localDMs.filter(dm => !discoveryWorkflowEnabled || dm !== "Lensly").map(dm => {
                const dmId = "dm_" + [me?.username || "", dm].sort().join("_");
                const dmUser2 = allUsers.find(u => u.username === dm);
                return (
                  <div key={dm} style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
                    <button className={`channel-btn ${activeChannelId === dmId ? "active" : ""}`} style={{ flex: 1 }} onClick={() => setActiveChannelId(dmId)}>
                      <div style={{ position: "relative" }}>
                        <Avatar user={{ username: dm, avatarUrl: dmUser2?.avatarUrl }} size={24} />
                        {dmUser2 && <span className="presence-dot-sm" style={{ background: PRESENCE_COLORS[(dmUser2.presenceStatus as Presence) || "OFFLINE"] }} />}
                      </div>
                      {dm}
                    </button>
                    <button title="Remove" onClick={() => setLocalDMs(d => d.filter(x => x !== dm))} style={{ fontSize: 11, color: "var(--text-dim)", background: "none", border: "none" }}>✕</button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ─── Nav Cards ─── */}
        <div style={{ padding: "4px 10px 6px", display: "flex", flexDirection: "column", gap: 3 }}>
          <Link to="/profile" style={{ textDecoration: "none" }}>
            <div className={`quick-nav-card ${location.pathname === "/profile" ? "qnc-active qnc-blue" : ""}`}>
              <div className="quick-nav-icon qni-blue">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <span className="quick-nav-label">Profile</span>
              <svg className="quick-nav-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>

          <Link to="/settings" style={{ textDecoration: "none" }}>
            <div className={`quick-nav-card ${location.pathname === "/settings" ? "qnc-active qnc-purple" : ""}`}>
              <div className="quick-nav-icon qni-purple">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9"/></svg>
              </div>
              <span className="quick-nav-label">Settings</span>
              <svg className="quick-nav-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>

          {me?.role && ["TRIAL_MODERATOR","MODERATOR","MODERATOR_PLUS","ADMIN","MANAGER","DEVELOPER","CO_OWNER","OWNER"].includes(me.role.toUpperCase()) && (
            <Link to="/admin" style={{ textDecoration: "none" }}>
              <div className={`quick-nav-card ${location.pathname === "/admin" ? "qnc-active qnc-cyan" : ""}`}>
                <div className="quick-nav-icon qni-cyan">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <span className="quick-nav-label">Admin Panel</span>
                <svg className="quick-nav-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </Link>
          )}

          <Link to="/support" style={{ textDecoration: "none" }}>
            <div className={`quick-nav-card ${location.pathname === "/support" ? "qnc-active qnc-green" : ""}`}>
              <div className="quick-nav-icon qni-green">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <span className="quick-nav-label">Support</span>
              <svg className="quick-nav-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>
        </div>

        {/* ─── Premium User Panel ─── */}
        <div className="user-panel-glass" style={{ position: "relative" }}>
          {showPresenceMenu && (
            <div className="status-menu">
              {/* Custom status input */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Custom Status</div>
                {showStatusEdit ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={statusDraft} onChange={e => setStatusDraft(e.target.value)} placeholder="What's on your mind?"
                      autoFocus onKeyDown={e => { if (e.key === "Enter") void saveCustomStatus(); if (e.key === "Escape") { setShowStatusEdit(false); } }}
                      style={{ flex: 1, padding: "5px 8px", borderRadius: 6, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 12 }} />
                    <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={saveCustomStatus}>✓</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                    onClick={() => { setStatusDraft(customStatus); setShowStatusEdit(true); }}>
                    <span style={{ flex: 1, fontSize: 12, color: customStatus ? "var(--text)" : "var(--text-muted)" }}>
                      {customStatus || "Set a status..."}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>✏️</span>
                  </div>
                )}
              </div>
              {/* Presence options */}
              {(["ONLINE", "IDLE", "DND", "OFFLINE"] as Presence[]).map((p) => (
                <div key={p} className="status-menu-item" onClick={() => void updatePresence(p)}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: PRESENCE_COLORS[p], display: "inline-block", flexShrink: 0 }} />
                  {PRESENCE_LABELS[p]}
                </div>
              ))}
              {/* PTT / Voice Settings */}
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <div style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Voice Settings</div>
              <div className="status-menu-item" onClick={() => { setPttEnabled(e => !e); }}>
                <span>{pttEnabled ? "✅" : "☐"}</span> Push-to-Talk
              </div>
              <div className="status-menu-item" onClick={() => setNoiseSuppress(n => !n)}>
                <span>{noiseSuppress ? "✅" : "☐"}</span> Noise Suppression
              </div>
              <div style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Quality:</span>
                {(["LOW", "MED", "HIGH"] as const).map(q => (
                  <button key={q} onClick={() => setStreamQuality(q)}
                    style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 700, border: "1px solid", borderColor: streamQuality === q ? "var(--accent)" : "var(--border)", color: streamQuality === q ? "var(--accent)" : "var(--text-muted)", background: "transparent" }}>
                    {q}
                  </button>
                ))}
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <div className="status-menu-item" style={{ color: "var(--danger)" }} onClick={() => { setShowPresenceMenu(false); void logout(); }}>
                🚪 Log out
              </div>
            </div>
          )}

          {/* Avatar + identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); setShowPresenceMenu(!showPresenceMenu); }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Avatar user={me ?? { username: "me" }} size={34} />
              <span className={`presence-dot ${presence}`} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {me?.displayName ?? me?.username}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {customStatus || PRESENCE_LABELS[presence]}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button className="upg-action-btn" title={presence === "DND" ? "Unmute" : "Mute / DND"}
              onClick={() => void updatePresence(presence === "DND" ? "ONLINE" : "DND")}>
              {presence === "DND"
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              }
            </button>
            <Link to="/settings" className="upg-action-btn" title="Settings" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9"/></svg>
            </Link>
          </div>
        </div>
      </aside>

      {/* ─── Chat Area ─── */}
      <main className="chat-area">
        {activeGuild && (activeGuild.status === "SUSPENDED" || activeGuild.status === "DELETED") && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "var(--bg-deep)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>{activeGuild.status === "SUSPENDED" ? "⚠️" : "❌"}</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, color: activeGuild.status === "SUSPENDED" ? "#F59E0B" : "#EF4444" }}>
              Server {activeGuild.status === "SUSPENDED" ? "Suspended" : "Deleted"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 16, maxWidth: 500, lineHeight: 1.6, marginBottom: 32 }}>
              This server has been {activeGuild.status === "SUSPENDED" ? "suspended" : "permanently deleted"} for violations of the Lensly Terms of Service.
              <br/><br/>
              <strong>You are viewing this server in Management Mode.</strong>
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button className="btn" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }} onClick={() => setActiveGuildId(null)}>Leave Server View</button>
            </div>
          </div>
        )}

        <div className="chat-header">
          {isLenslyDm ? (
            <>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src="/logo.png" alt="Lensly" style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  objectFit: "cover",
                  boxShadow: "0 0 12px rgba(79,124,255,0.45)",
                  border: "1.5px solid rgba(255,255,255,0.15)"
                }} />
                <span style={{
                  position: "absolute", bottom: -1, right: -1,
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#10B981", border: "2px solid var(--bg-elevated)"
                }} />
              </div>
              <span className="chat-header-name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Lensly SYSTEM
                <span style={{
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#34D399",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "1px 5px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  lineHeight: "1"
                }}>
                  Verified Bot
                </span>
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 18, color: "var(--text-muted)" }}>#</span>
              <span className="chat-header-name">
                {activeGuild?.channels?.find((c) => c.id === activeChannelId)?.name ?? (activeChannelId ? activeChannelId.replace("dm_", "").replace(/_/g, " ").replace(me?.username ?? "", "").replace("_", "").trim() : "Select a channel")}
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {/* Boost button */}
          {activeGuild && (
            <button className="btn btn-ghost" style={{ fontSize: 12, gap: 4, color: "#FF5EAD" }}
              onClick={(e) => { e.stopPropagation(); setShowBoostModal(true); }}>
              🚀 Boost {activeGuild.boostCount ? `(${activeGuild.boostCount})` : ""}
            </button>
          )}
          {/* Pinned button */}
          {activeChannelId && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={(e) => { e.stopPropagation(); setShowPinnedPanel(p => !p); }}>
              📌 {pinnedMessages.length > 0 ? pinnedMessages.length : ""}
            </button>
          )}
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", display: "inline-block" }} />
            Live
          </div>
        </div>

        {/* Pinned Panel */}
        {showPinnedPanel && (
          <div className="pinned-panel">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
              📌 Pinned Messages ({pinnedMessages.length})
              <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setShowPinnedPanel(false)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 280, padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {pinnedMessages.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No pinned messages yet.</div>
              ) : (
                pinnedMessages.map(m => (
                  <div key={m.id} className="pinned-msg-row">
                    <Avatar user={m.author} size={24} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{m.author.displayName ?? m.author.username}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{(m.editedContent ?? m.content).slice(0, 100)}</div>
                    </div>
                    {(activeGuild?.ownerId === me?.id || me?.admin) && (
                      <button style={{ fontSize: 11, color: "var(--text-muted)" }} onClick={() => void pinMessage(m)}>Unpin</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="chat-messages" style={isLenslyDm && messages.length === 0 ? { display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" } : {}}>
          {isLenslyDm && (
            <div style={{
              width: "100%",
              maxWidth: 720,
              margin: messages.length === 0 ? "auto" : "0 auto 30px auto",
              background: "linear-gradient(135deg, rgba(20, 20, 20, 0.65), rgba(10, 10, 10, 0.85))",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 20,
              padding: "40px 32px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
              position: "relative",
              overflow: "hidden",
              fontFamily: "var(--font)",
              animation: "fadeIn 0.6s ease"
            }}>
              {/* Decorative accent glow */}
              <div style={{
                position: "absolute",
                top: "-150px",
                right: "-150px",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
                pointerEvents: "none"
              }} />
              <div style={{
                position: "absolute",
                bottom: "-150px",
                left: "-150px",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(79, 124, 255, 0.08) 0%, transparent 70%)",
                pointerEvents: "none"
              }} />

              {/* Logo & Intro */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 32 }}>
                <div style={{ position: "relative", marginBottom: 20 }}>
                  <img src="/logo.png" alt="Lensly Logo" style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    boxShadow: "0 8px 30px rgba(79, 124, 255, 0.3)",
                    border: "2px solid rgba(255, 255, 255, 0.1)"
                  }} />
                  <div style={{
                    position: "absolute",
                    bottom: -3,
                    right: -3,
                    background: "#10B981",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #000",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                </div>
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#34D399",
                  textTransform: "uppercase",
                  letterSpacing: "2.5px",
                  marginBottom: 8
                }}>
                  Official Secure Feed
                </div>
                <h2 style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                  marginBottom: 10
                }}>
                  Lensly Core Security
                </h2>
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text-muted)",
                  maxWidth: 500,
                  margin: "0 auto"
                }}>
                  Welcome to your secure communication portal. This dedicated feed receives direct system alerts, role updates, and platform notices verified directly by the Lensly core.
                </p>
              </div>

              {/* Grid Layout */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 32
              }}>
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: 14,
                  padding: 18,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>🛡️</div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Cryptographic Trust</h4>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Every notification is signed and authenticated. Fake system accounts cannot simulate this channel.
                  </p>
                </div>
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: 14,
                  padding: 18,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>🔔</div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Direct Log Updates</h4>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Receive real-time alerts regarding server suspensions, security events, or warning strikes.
                  </p>
                </div>
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: 14,
                  padding: 18,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>🔒</div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Appeals & Support</h4>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    You cannot send outbound replies here. For help or appeals, please use the Support module.
                  </p>
                </div>
              </div>

              {/* Status panel */}
              <div style={{
                background: "rgba(16, 185, 129, 0.04)",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 8px #10B981",
                    animation: "statusPulse 2s infinite",
                    display: "inline-block"
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    System Status: All Services Operational
                  </span>
                </div>
                <Link to="/support" style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34D399",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: "none",
                  transition: "all 0.2s ease"
                }}>
                  Get Assistance
                </Link>
              </div>
            </div>
          )}

          {messages.map((m, i) => renderMessage(m, i))}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <TypingDots />
            <span>
              {typingUsers.length === 1 ? `${typingUsers[0].username} is typing...`
                : typingUsers.length === 2 ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <div className="reply-preview">
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>↱ Replying to <strong>{replyingTo.author.displayName ?? replyingTo.author.username}</strong>: {(replyingTo.editedContent ?? replyingTo.content).slice(0, 60)}</span>
            <button onClick={() => setReplyingTo(null)} style={{ fontSize: 13, color: "var(--text-muted)", background: "none", border: "none" }}>✕</button>
          </div>
        )}

        <div className="chat-input-wrap">
          <div className="chat-input-box">
            {!isLenslyDm && (
              <div className="chat-input-actions">
                <label title="Attach file" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, color: "var(--text-muted)" }}>
                  📎
                  <input type="file" style={{ display: "none" }} accept="image/*,video/*,*/*"
                    onChange={(e) => { if (e.target.files?.[0]) { void handleFileUpload(e.target.files[0]); e.target.value = ""; } }} />
                </label>
              </div>
            )}
            {isLenslyDm ? (
              <div style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(20, 20, 20, 0.75), rgba(10, 10, 10, 0.85))",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                color: "var(--text-muted)",
                fontSize: 12.5,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flex: 1,
                userSelect: "none"
              }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span>This is the official Lensly system account. Outbound messaging is disabled.</span>
              </div>
            ) : (
              <textarea ref={textareaRef} value={draft} onChange={autoGrow}
                placeholder={`Message ${activeGuild?.channels?.find((c) => c.id === activeChannelId)?.name ? "#" + activeGuild.channels.find((c) => c.id === activeChannelId)!.name : "..."}`}
                rows={1} style={{ lineHeight: "22px" }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} />
            )}
            {!isLenslyDm && (
              <div className="chat-input-actions">
                <div style={{ position: "relative" }}>
                  <button title="Emoji" onClick={(e) => { e.stopPropagation(); setEmojiTarget("INPUT"); setShowEmojiPicker(p => !p); }}>😊</button>
                  {showEmojiPicker && (
                    <div className="emoji-picker" onClick={e => e.stopPropagation()}>
                      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>EMOJI</div>
                      <div className="emoji-grid">
                        {QUICK_EMOJI.map(em => (
                          <button key={em} className="emoji-btn" onClick={() => {
                            if (emojiTarget === "INPUT") {
                              setDraft(d => d + em);
                            } else {
                              void sendReaction(emojiTarget, em);
                            }
                            setShowEmojiPicker(false);
                          }}>{em}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button title="Send" onClick={() => void sendMessage()} style={{ color: draft.trim() ? "var(--accent)" : undefined }}>➤</button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── Member List Sidebar ─── */}
      {activeGuild && (() => {
        // Enforce visibility settings
        const isGlobalStaff = me?.role && ["TRIAL_MODERATOR", "MODERATOR", "MODERATOR_PLUS", "ADMIN", "MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());
        const isServerOwner = activeGuild.ownerId === me?.id;
        const defaultRole = activeGuild.roles?.find(r => r.id === "default") || { id: "default", permissions: ["SEND_MESSAGES"] };
        const baseGuildPerms = [
          ...(defaultRole.permissions || []),
          ...((activeGuild.memberRoles || {})[me?.id || ""]?.flatMap(rid => activeGuild.roles?.find(r => r.id === rid)?.permissions || []) || [])
        ];
        const myGuildPermissions = [...baseGuildPerms, ...(me?.role?.toUpperCase() === "DEVELOPER" ? ["ADMINISTRATOR"] : [])];
        const hasServerAdmin = ["ADMINISTRATOR", "MANAGE_GUILD"].some(p => myGuildPermissions.includes(p));
        const canSeeMemberList = !activeGuild.hideMemberList || isServerOwner || hasServerAdmin || isGlobalStaff;

        if (!canSeeMemberList) {
          return (
            <aside className="member-sidebar" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", opacity: 0.5 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Member List Hidden</div>
            </aside>
          );
        }

        let guildMembers = allUsers.filter(u => activeGuild.members?.includes(u.id) || u.id === activeGuild.ownerId);
        
        // Search filter
        if (memberSearch.trim()) {
          const s = memberSearch.toLowerCase();
          guildMembers = guildMembers.filter(u => (u.displayName?.toLowerCase() || "").includes(s) || (u.username?.toLowerCase() || "").includes(s));
        }

        const displayedIds = new Set<string>();
        const hoistedRoles = (activeGuild.roles || []).filter(r => r.hoist);

        const renderUserWithBadge = (u: any, roleColor: string, isOnline: boolean) => {
          const userRoles = (activeGuild.memberRoles || {})[u.id] || [];
          const highestRole = (activeGuild.roles || []).find(r => userRoles.includes(r.id));
          return (
            <button key={u.id} className="channel-btn" style={{ justifyContent: "flex-start", gap: 8, opacity: isOnline ? 1 : 0.5, padding: "6px 8px" }} onClick={() => setSelectedUserProfile(u)} onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMemberContextMenu({ x: e.clientX, y: e.clientY, userId: u.id, user: u });
            }}>
              <div style={{ position: "relative" }}>
                <Avatar user={u} size={28} />
                <span className="presence-dot-sm" style={{ background: PRESENCE_COLORS[(u.presenceStatus as Presence) || "OFFLINE"] }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflow: "hidden" }}>
                <span style={{ fontSize: 13, fontWeight: roleColor !== "inherit" ? 600 : "normal", color: roleColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.displayName ?? u.username}</span>
                {highestRole && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 4px", borderRadius: 4, background: highestRole.color !== "transparent" && highestRole.color ? highestRole.color : "var(--bg-deep)", color: highestRole.color !== "transparent" && highestRole.color ? "#fff" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {highestRole.name.substring(0, 12)}{highestRole.name.length > 12 ? "..." : ""}
                  </span>
                )}
              </div>
            </button>
          );
        };

        return (
          <aside className="member-sidebar">
            <div className="member-header" style={{ paddingBottom: 0 }}>Members — {guildMembers.length}</div>
            <div style={{ padding: "8px 16px" }}>
              <input 
                type="text" 
                placeholder="Search members..." 
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "var(--bg-deep)", border: "none", color: "var(--text)", fontSize: 12 }} 
              />
            </div>
            <div className="member-list" style={{ paddingTop: 4 }}>
              {hoistedRoles.map(role => {
                const roleMembers = guildMembers.filter(u => {
                  if (displayedIds.has(u.id)) return false;
                  return ((activeGuild.memberRoles || {})[u.id] || []).includes(role.id);
                });
                if (!roleMembers.length) return null;
                roleMembers.forEach(m => displayedIds.add(m.id));
                return (
                  <div key={role.id}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: role.color, padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{role.name} — {roleMembers.length}</div>
                    {roleMembers.map(u => renderUserWithBadge(u, role.color || "inherit", u.presenceStatus !== "OFFLINE"))}
                  </div>
                );
              })}

              {/* Online */}
              {(() => {
                const online = guildMembers.filter(u => !displayedIds.has(u.id) && u.presenceStatus !== "OFFLINE");
                if (!online.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px", textTransform: "uppercase" }}>Online — {online.length}</div>
                    {online.map(u => {
                      const userRoles = (activeGuild.memberRoles || {})[u.id] || [];
                      const matchingRole = (activeGuild.roles || []).find(r => userRoles.includes(r.id) && r.color && r.color !== "transparent");
                      return renderUserWithBadge(u, matchingRole?.color || "inherit", true);
                    })}
                  </>
                );
              })()}

              {/* Offline */}
              {(() => {
                const offline = guildMembers.filter(u => !displayedIds.has(u.id) && u.presenceStatus === "OFFLINE");
                if (!offline.length) return null;
                return (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "12px 8px 4px", textTransform: "uppercase" }}>Offline — {offline.length}</div>
                    {offline.map(u => {
                      const userRoles = (activeGuild.memberRoles || {})[u.id] || [];
                      const matchingRole = (activeGuild.roles || []).find(r => userRoles.includes(r.id) && r.color && r.color !== "transparent");
                      return renderUserWithBadge(u, matchingRole?.color || "inherit", false);
                    })}
                  </>
                );
              })()}
            </div>
          </aside>
        );
      })()}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ─── Create/Join Server Modal ─── */}
      {showNewServer && (
        <div className="profile-modal-overlay" onClick={() => setShowNewServer(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 480, maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {(["TEMPLATES", "CREATE", "JOIN"] as const).map(tab => (
                <button key={tab} onClick={() => setAddServerTab(tab)}
                  style={{ fontSize: 14, fontWeight: 800, color: addServerTab === tab ? "var(--text)" : "var(--text-muted)", borderBottom: addServerTab === tab ? "2px solid var(--accent)" : "none", paddingBottom: 6 }}>
                  {tab === "TEMPLATES" ? "🗂️ Templates" : tab === "CREATE" ? "✨ Create" : "🔗 Join"}
                </button>
              ))}
            </div>

            {addServerTab === "TEMPLATES" && (
              <>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>Choose a template to quickly set up your server with pre-built channels.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {SERVER_TEMPLATES.map(t => (
                    <div key={t.id} onClick={() => { setSelectedTemplate(t); setAddServerTab("CREATE"); }}
                      className="template-card">
                      <div style={{ fontSize: 28 }}>{t.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {addServerTab === "CREATE" && (
              <>
                {selectedTemplate.id !== "blank" && (
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{selectedTemplate.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>Using Template: {selectedTemplate.name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{selectedTemplate.channels.length} channels will be created</div>
                    </div>
                    <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => setSelectedTemplate(SERVER_TEMPLATES[0])}>✕</button>
                  </div>
                )}
                <div className="field" style={{ marginBottom: 20 }}>
                  <label>Server Name</label>
                  <input placeholder="My Awesome Server" value={newGuildName} onChange={e => setNewGuildName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void createGuild(); }} autoFocus />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewServer(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void createGuild()}>Create Server</button>
                </div>
              </>
            )}

            {addServerTab === "JOIN" && (
              <>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>Enter an invite link or Server ID to join.</div>
                <div className="field" style={{ marginBottom: 20 }}>
                  <label>Invite Link or Server ID</label>
                  <input placeholder="https://Lensly.app/invite/abc123" value={inviteId} onChange={e => setInviteId(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void joinGuild(); }} autoFocus />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewServer(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void joinGuild()}>Join Server</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Server Discovery Modal ─── */}
      {showDiscovery && (
        <div className="profile-modal-overlay" onClick={() => setShowDiscovery(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 600, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>🔍 Discover Servers</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Find public communities to join</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowDiscovery(false)}>✕</button>
            </div>
            <input placeholder="Search servers..." value={discoverySearch} onChange={e => setDiscoverySearch(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 14, marginBottom: 16 }} />
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {publicGuilds.filter(g => !discoverySearch || g.name.toLowerCase().includes(discoverySearch.toLowerCase())).map(g => (
                <div key={g.id} className="discovery-card">
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {g.iconUrl ? <img src={g.iconUrl} alt={g.name} style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} /> : g.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.description || "A Lensly community"} • {g.members?.length || 0} members</div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: "7px 16px", fontSize: 13 }} onClick={() => void joinFromDiscovery(g)}>
                    {(g.members || []).includes(me?.id || "") ? "Open" : "Join"}
                  </button>
                </div>
              ))}
              {publicGuilds.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
                  <div style={{ fontWeight: 700 }}>No public servers found</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>Server owners can make their server public in Server Settings</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Server Boost Modal ─── */}
      {showBoostModal && activeGuild && (
        <div className="profile-modal-overlay" onClick={() => setShowBoostModal(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🚀</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Boost {activeGuild.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Support this server and unlock exclusive perks for the community!</div>
            </div>

            {/* Boost progress */}
            <div style={{ background: "var(--bg-deep)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Current Boosts</span>
                <span style={{ fontWeight: 800, color: "#FF5EAD" }}>{activeGuild.boostCount ?? 0}</span>
              </div>
              <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, #8C5EFF, #FF5EAD)", borderRadius: 4, width: `${Math.min(((activeGuild.boostCount ?? 0) / 14) * 100, 100)}%`, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                <span>0</span><span>2 (Lv 1)</span><span>7 (Lv 2)</span><span>14 (Lv 3)</span>
              </div>
            </div>

            {showBoostCheckout ? (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>💳 Complete Server Boost Payment</div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Enter simulated payment details to purchase a Boost for <strong>{activeGuild.name}</strong>.
                  </p>
                </div>
                <div className="field">
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Cardholder Name</label>
                  <input
                    value={checkoutName}
                    onChange={(e) => setCheckoutName(e.target.value)}
                    placeholder="John Doe"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 14 }}
                  />
                </div>
                <div className="field">
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Card Number</label>
                  <input
                    value={checkoutCard}
                    onChange={(e) => setCheckoutCard(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    placeholder="4111 2222 3333 4444"
                    maxLength={16}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 14 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Expiration (MM/YY)</label>
                    <input
                      value={checkoutExpiry}
                      onChange={(e) => setCheckoutExpiry(e.target.value.slice(0, 5))}
                      placeholder="12/28"
                      maxLength={5}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 14 }}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>CVV</label>
                    <input
                      value={checkoutCvv}
                      onChange={(e) => setCheckoutCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      placeholder="123"
                      maxLength={3}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: 12, borderRadius: 8, fontSize: 11, color: "#F59E0B", marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                  <span>🔒</span>
                  <span>Billing is disabled. Payment gateway integration coming soon!</span>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, padding: 12 }} onClick={() => setShowBoostCheckout(false)}>
                    Back
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={() => void boostServer()}>
                    Confirm & Pay ($4.99)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Perks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {BOOST_PERKS.map(tier => (
                    <div key={tier.level} style={{ background: "var(--bg-deep)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${(activeGuild.boostCount ?? 0) >= tier.count ? tier.color : "var(--border)"}`, opacity: (activeGuild.boostCount ?? 0) >= tier.count ? 1 : 0.6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: tier.color }}>{tier.label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({tier.count} boosts)</span>
                        {(activeGuild.boostCount ?? 0) >= tier.count && <span style={{ marginLeft: "auto", fontSize: 11, color: "#34D399", fontWeight: 700 }}>✓ Unlocked</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {tier.perks.map(p => <span key={p} style={{ fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 20 }}>{p}</span>)}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 800 }} onClick={() => void boostServer()}>
                  🚀 Boost This Server
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Create Channel Modal ─── */}
      {showNewChannel && (
        <div className="profile-modal-overlay" onClick={() => setShowNewChannel(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Create Channel</div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Channel Type</label>
              <div style={{ display: "grid", gap: 8 }}>
                {[["TEXT", "# Text Channel"], ["VOICE", "🔊 Voice Channel"], ["CATEGORY", "📁 Category"]].map(([type, label]) => (
                  <label key={type} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: newChannelType === type ? "var(--bg-active)" : "var(--bg-deep)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <input type="radio" name="chanType" checked={newChannelType === type} onChange={() => setNewChannelType(type as any)} style={{ display: "none" }} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Channel Name</label>
              <input placeholder="new-channel" value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void createChannel(); }} autoFocus />
            </div>
            {newChannelType === "VOICE" && (
              <div className="field" style={{ marginBottom: 16 }}>
                <label>User Limit (0 = unlimited)</label>
                <input type="number" min="0" max="99" placeholder="0" defaultValue="0"
                  onChange={e => { /* stored on creation */ }}
                  style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff" }} />
              </div>
            )}
            {newChannelType !== "CATEGORY" && (
              <div className="field" style={{ marginBottom: 20 }}>
                <label>Parent Category (optional)</label>
                <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff" }}>
                  <option value="">No Category</option>
                  {activeGuild?.channels?.filter(c => c.type === "CATEGORY").map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewChannel(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void createChannel()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Server Settings Modal ─── */}
      {showServerSettings && activeGuild && (
        <div className="profile-modal-overlay" onClick={() => setShowServerSettings(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Server Settings: {activeGuild.name}</div>
              <button className="btn btn-ghost" onClick={() => setShowServerSettings(false)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: 16, background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                {activeGuild.iconUrl ? <img src={activeGuild.iconUrl} alt="icon" style={{ width: "100%", height: "100%", borderRadius: 16, objectFit: "cover" }} /> : activeGuild.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Server Name</label>
                <input value={activeGuild.name} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff" }} readOnly />
                {activeGuildHasAdmin && (
                  <label style={{ cursor: "pointer", display: "inline-block", marginTop: 8 }}>
                    <span className="btn btn-ghost" style={{ fontSize: 12, background: "var(--bg-deep)", border: "1px solid var(--border)" }}>Upload Logo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        const reader = new FileReader();
                        reader.onloadend = async () => { await updateDoc(doc(db, "guilds", activeGuild.id), { iconUrl: reader.result as string }); };
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }} />
                  </label>
                )}
                <label style={{ display: "block", fontSize: 13, marginTop: 12, marginBottom: 6 }}>Server ID</label>
                <input value={activeGuild.id} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontFamily: "var(--mono)", fontSize: 12 }} readOnly />
                <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={() => { navigator.clipboard.writeText(activeGuild.id); alert("Server ID copied!"); }}>📋 Copy ID</button>
              </div>
            </div>

            {activeGuildHasAdmin && (<>
            {/* Banner URL and File Input */}
            <div style={{ display: "grid", gap: 10, marginBottom: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Server Banner Image</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  value={activeGuild.bannerUrl || ""}
                  placeholder="Paste banner image URL..."
                  onChange={async (e) => {
                    await updateDoc(doc(db, "guilds", activeGuild.id), { bannerUrl: e.target.value });
                  }}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 13 }}
                />
                <label style={{ cursor: "pointer" }}>
                  <span className="btn btn-ghost" style={{ fontSize: 12, background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px" }}>Upload Banner</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    if (e.target.files?.[0]) {
                      const reader = new FileReader();
                      reader.onloadend = async () => { await updateDoc(doc(db, "guilds", activeGuild.id), { bannerUrl: reader.result as string }); };
                      reader.readAsDataURL(e.target.files[0]);
                    }
                  }} />
                </label>
              </div>
            </div>

            {/* Public toggle with Staff Approval Workflow */}
            {!discoveryWorkflowEnabled ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", background: "var(--bg-deep)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🌐 Public Server (Discovery)</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>List this server in the server discovery directory</div>
                </div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={activeGuild.isPublic || false} onChange={async (e) => {
                    await updateDoc(doc(db, "guilds", activeGuild.id), { isPublic: e.target.checked });
                  }} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                </label>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px", background: "var(--bg-deep)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>🌐 Public Server (Discovery)</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>You need to be accepted before joining this page</div>
                  </div>
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" 
                      checked={activeGuild.isPublic || activeGuild.discoveryStatus === "PENDING" || activeGuild.discoveryStatus === "APPROVED" || showDiscoveryForm}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          setShowDiscoveryForm(true);
                        } else {
                          if (confirm("Are you sure you want to cancel your public server discovery request or unpublish the server?")) {
                            await updateDoc(doc(db, "guilds", activeGuild.id), { 
                              discoveryStatus: "NONE",
                              isPublic: false,
                              discoveryRequest: null
                            });
                            setShowDiscoveryForm(false);
                          }
                        }
                      }}
                      style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                  </label>
                </div>
                
                {/* Discovery Questionnaire Form */}
                {showDiscoveryForm && activeGuild.discoveryStatus !== "PENDING" && activeGuild.discoveryStatus !== "APPROVED" && (
                  <div style={{
                    marginTop: 4,
                    padding: "16px",
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#34D399", display: "flex", alignItems: "center", gap: 6 }}>
                      📋 Discovery Application Form
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Please fill out this quick application to submit your server to Lensly Staff for public listing.
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Why do you want to list this server? *</label>
                      <textarea 
                        value={discoveryWhyJoin} 
                        onChange={(e) => setDiscoveryWhyJoin(e.target.value)}
                        placeholder="e.g., We want to build an active community for learning coding, exchanging tips, and working on open-source projects..."
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--bg-deep)",
                          border: "1px solid var(--border)",
                          color: "#fff",
                          fontSize: 12,
                          minHeight: 60,
                          resize: "vertical"
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Current Member Count *</label>
                        <input 
                          type="number"
                          value={discoveryMemberCount} 
                          onChange={(e) => setDiscoveryMemberCount(e.target.value)}
                          placeholder="e.g. 150"
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: "var(--bg-deep)",
                            border: "1px solid var(--border)",
                            color: "#fff",
                            fontSize: 12
                          }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Primary Category *</label>
                        <select 
                          value={discoveryCategory} 
                          onChange={(e) => setDiscoveryCategory(e.target.value)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: "var(--bg-deep)",
                            border: "1px solid var(--border)",
                            color: "#fff",
                            fontSize: 12,
                            height: "100%"
                          }}
                        >
                          <option value="Gaming">Gaming</option>
                          <option value="Social">Social</option>
                          <option value="Anime">Anime / Manga</option>
                          <option value="Art">Art & Design</option>
                          <option value="Programming">Programming & Tech</option>
                          <option value="Music">Music</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Server Rules & Review Details</label>
                      <textarea 
                        value={discoveryGuidelines} 
                        onChange={(e) => setDiscoveryGuidelines(e.target.value)}
                        placeholder="e.g., We enforce kind behavior, have 5 dedicated moderators, and follow full platform rules..."
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--bg-deep)",
                          border: "1px solid var(--border)",
                          color: "#fff",
                          fontSize: 12,
                          minHeight: 50,
                          resize: "vertical"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button 
                        className="btn" 
                        style={{ flex: 1, padding: "8px 16px", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600 }}
                        onClick={async () => {
                          if (!discoveryWhyJoin.trim()) {
                            alert("Please explain why you want to list this server in Public Discovery.");
                            return;
                          }
                          if (!discoveryMemberCount.trim() || isNaN(Number(discoveryMemberCount))) {
                            alert("Please enter a valid approximate member count.");
                            return;
                          }
                          try {
                            await updateDoc(doc(db, "guilds", activeGuild.id), { 
                              discoveryStatus: "PENDING",
                              isPublic: false,
                              discoveryRequest: {
                                whyJoin: discoveryWhyJoin.trim(),
                                memberCount: parseInt(discoveryMemberCount, 10),
                                category: discoveryCategory,
                                guidelines: discoveryGuidelines.trim(),
                                submittedAt: Date.now()
                              }
                            });
                            setShowDiscoveryForm(false);
                            alert("Your Discovery Application has been submitted to Lensly Staff for approval!");
                          } catch (err) {
                            alert("Failed to submit request: " + String(err));
                          }
                        }}
                      >
                        Submit Application
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        style={{ flex: 1, padding: "8px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", fontSize: 12 }}
                        onClick={() => {
                          setShowDiscoveryForm(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Discovery status banner */}
                {activeGuild.discoveryStatus && activeGuild.discoveryStatus !== "NONE" && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: activeGuild.discoveryStatus === "PENDING" 
                      ? "rgba(245,158,11,0.1)" 
                      : activeGuild.discoveryStatus === "APPROVED"
                      ? "rgba(52,211,153,0.1)"
                      : "rgba(239,68,68,0.1)",
                    border: "1px solid",
                    borderColor: activeGuild.discoveryStatus === "PENDING" 
                      ? "rgba(245,158,11,0.2)" 
                      : activeGuild.discoveryStatus === "APPROVED"
                      ? "rgba(52,211,153,0.2)"
                      : "rgba(239,68,68,0.2)",
                    color: activeGuild.discoveryStatus === "PENDING" 
                      ? "#F59E0B" 
                      : activeGuild.discoveryStatus === "APPROVED"
                      ? "#34D399"
                      : "#EF4444"
                  }}>
                    <span>
                      {activeGuild.discoveryStatus === "PENDING" && "⏳ Discovery status: Pending Staff Approval"}
                      {activeGuild.discoveryStatus === "APPROVED" && "✅ Discovery status: Approved & Listed in Directory"}
                      {activeGuild.discoveryStatus === "REJECTED" && "❌ Discovery status: Rejected by Staff"}
                    </span>
                    {activeGuild.discoveryStatus === "PENDING" && (
                      <button 
                        className="btn" 
                        style={{ fontSize: 10, padding: "2px 8px", background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        onClick={async () => {
                          if (confirm("Are you sure you want to cancel your public server discovery request?")) {
                            await updateDoc(doc(db, "guilds", activeGuild.id), { 
                              discoveryStatus: "NONE",
                              isPublic: false,
                              discoveryRequest: null
                            });
                          }
                        }}
                      >
                        Cancel Request
                      </button>
                    )}
                    {activeGuild.discoveryStatus === "REJECTED" && (
                      <button 
                        className="btn" 
                        style={{ fontSize: 10, padding: "2px 8px", background: "rgba(79,124,255,0.15)", color: "var(--accent)", border: "1px solid rgba(79,124,255,0.3)" }}
                        onClick={() => {
                          // Populate state with existing answers if any
                          if (activeGuild.discoveryRequest) {
                            setDiscoveryWhyJoin(activeGuild.discoveryRequest.whyJoin || "");
                            setDiscoveryMemberCount(String(activeGuild.discoveryRequest.memberCount || ""));
                            setDiscoveryCategory(activeGuild.discoveryRequest.category || "Social");
                            setDiscoveryGuidelines(activeGuild.discoveryRequest.guidelines || "");
                          }
                          setShowDiscoveryForm(true);
                        }}
                      >
                        Re-apply
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hide Member List toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--bg-deep)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>👥 Hide Member List</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Hide the member list for regular members</div>
              </div>
              <label style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={activeGuild.hideMemberList || false}
                  onChange={async (e) => { await updateDoc(doc(db, "guilds", activeGuild.id), { hideMemberList: e.target.checked }); }}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
              </label>
            </div>

            {/* Moderation & Security */}
            <div style={{ display: "grid", gap: 12, marginBottom: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>🛡️ Moderation & Security</label>
              
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Verification Level</label>
                <select
                  value={activeGuild.verificationLevel || "NONE"}
                  onChange={async (e) => {
                    await updateDoc(doc(db, "guilds", activeGuild.id), { verificationLevel: e.target.value });
                  }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 13 }}
                >
                  <option value="NONE">None (No restrictions)</option>
                  <option value="LOW">Low (Must have verified email)</option>
                  <option value="MEDIUM">Medium (Registered on Lensly &gt; 5 min)</option>
                  <option value="HIGH">High (Member of this server &gt; 10 min)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-deep)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🚨 Raid Protection System</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Strictly verify new accounts joining rapidly</div>
                </div>
                <input
                  type="checkbox"
                  checked={activeGuild.raidProtection || false}
                  onChange={async (e) => {
                    await updateDoc(doc(db, "guilds", activeGuild.id), { raidProtection: e.target.checked });
                  }}
                  style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                />
              </div>

              <div style={{ background: "var(--bg-deep)", borderRadius: 8, border: "1px solid var(--border)", padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🤖 AutoMod Filters</div>
                  <input
                    type="checkbox"
                    checked={activeGuild.autoModEnabled !== false}
                    onChange={async (e) => {
                      await updateDoc(doc(db, "guilds", activeGuild.id), { autoModEnabled: e.target.checked });
                    }}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input type="checkbox" checked={activeGuild.autoModSpam !== false} onChange={async e => { await updateDoc(doc(db, "guilds", activeGuild.id), { autoModSpam: e.target.checked }); }} style={{ accentColor: "var(--accent)" }} />
                    Spam Filter
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input type="checkbox" checked={activeGuild.autoModScam !== false} onChange={async e => { await updateDoc(doc(db, "guilds", activeGuild.id), { autoModScam: e.target.checked }); }} style={{ accentColor: "var(--accent)" }} />
                    Scam Filter
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input type="checkbox" checked={activeGuild.autoModVulgar !== false} onChange={async e => { await updateDoc(doc(db, "guilds", activeGuild.id), { autoModVulgar: e.target.checked }); }} style={{ accentColor: "var(--accent)" }} />
                    Profanity
                  </label>
                </div>
              </div>
            </div>

            {/* Backup & Restore */}
            <div style={{ display: "grid", gap: 10, marginBottom: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>💾 Backup & Restore</label>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" style={{ flex: 1, fontSize: 12, padding: "8px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)", justifyContent: "center" }} onClick={() => {
                  const backup = {
                    name: activeGuild.name,
                    iconUrl: activeGuild.iconUrl || null,
                    bannerUrl: activeGuild.bannerUrl || null,
                    channels: activeGuild.channels || [],
                    roles: activeGuild.roles || [],
                    verificationLevel: activeGuild.verificationLevel || "NONE",
                    raidProtection: activeGuild.raidProtection || false,
                    autoModEnabled: activeGuild.autoModEnabled !== false,
                    autoModSpam: activeGuild.autoModSpam !== false,
                    autoModScam: activeGuild.autoModScam !== false,
                    autoModVulgar: activeGuild.autoModVulgar !== false,
                  };
                  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${activeGuild.name.replace(/\s+/g, "_")}_backup.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  📥 Export Backup
                </button>
                <label className="btn" style={{ flex: 1, fontSize: 12, padding: "8px 12px", background: "var(--bg-deep)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  📤 Restore Backup
                  <input type="file" accept=".json" style={{ display: "none" }} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const backup = JSON.parse(evt.target?.result as string);
                        if (!backup.name || !Array.isArray(backup.channels)) {
                          alert("Invalid backup file format.");
                          return;
                        }
                        if (confirm(`Restore server backup? This will overwrite roles, channels, and security settings.`)) {
                          await updateDoc(doc(db, "guilds", activeGuild.id), {
                            name: backup.name,
                            iconUrl: backup.iconUrl || null,
                            bannerUrl: backup.bannerUrl || null,
                            channels: backup.channels,
                            roles: backup.roles || [],
                            verificationLevel: backup.verificationLevel || "NONE",
                            raidProtection: backup.raidProtection || false,
                            autoModEnabled: backup.autoModEnabled !== false,
                            autoModSpam: backup.autoModSpam !== false,
                            autoModScam: backup.autoModScam !== false,
                            autoModVulgar: backup.autoModVulgar !== false,
                          });
                          alert("Server restored from backup successfully!");
                        }
                      } catch (err) {
                        alert("Failed to parse backup file: " + String(err));
                      }
                    };
                    reader.readAsText(file);
                  }} />
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <button className="btn" style={{ justifyContent: "space-between" }} onClick={() => { setShowServerSettings(false); setShowRolesModal(true); }}>
                <span>🛡️ Roles & Permissions</span><span>→</span>
              </button>
              <button className="btn" style={{ justifyContent: "space-between" }} onClick={() => { navigator.clipboard.writeText("https://Lensly.app/invite/" + activeGuild.id); alert("Invite link copied!"); }}>
                <span>💌 Invite People</span><span>→</span>
              </button>
              <button className="btn" style={{ justifyContent: "space-between" }} onClick={() => { setShowServerSettings(false); setShowBoostModal(true); }}>
                <span>🚀 Server Boost ({activeGuild.boostCount ?? 0})</span><span>→</span>
              </button>
            </div>
            </>)}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)", marginBottom: 8 }}>Danger Zone</div>
              {activeGuild.ownerId !== me?.id && (
                <button className="btn btn-danger" style={{ width: "100%", marginBottom: 8 }} onClick={() => void leaveServer(activeGuild.id, activeGuild.name)}>
                  🚪 Leave Server
                </button>
              )}
              {activeGuild.ownerId === me?.id && (
                <button className="btn btn-danger" style={{ width: "100%" }} onClick={async () => {
                  if (confirm(`Delete "${activeGuild.name}"? This is permanent!`)) {
                    await deleteDoc(doc(db, "guilds", activeGuild.id));
                    setShowServerSettings(false); setActiveGuildId(null);
                  }
                }}>Delete Server</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Roles Modal ─── */}
      {showRolesModal && activeGuild && (() => {
        const guildMembers = allUsers.filter(u => activeGuild.members?.includes(u.id) || u.id === activeGuild.ownerId);
        const currentRoles = activeGuild.roles || [];
        const hasEveryone = currentRoles.some(r => r.id === "default");
        const rolesList = hasEveryone ? currentRoles : [{ id: "default", name: "@everyone", color: "#9ca3af", permissions: ["SEND_MESSAGES"] }, ...currentRoles];
        const selectedRole = rolesList.find(r => r.id === selectedRoleId) || rolesList[0];
        const allPermissions = [
          { key: "ADMINISTRATOR", name: "Administrator", desc: "Grants all permissions and bypasses all restrictions" },
          { key: "MANAGE_SERVER", name: "Manage Server", desc: "Change settings, delete channels" },
          { key: "KICK_MEMBERS", name: "Kick Members", desc: "Remove members from the server" },
          { key: "MANAGE_CHANNELS", name: "Manage Channels", desc: "Create/edit/organize channels" },
          { key: "SEND_MESSAGES", name: "Send Messages", desc: "Send chat messages" },
          { key: "MANAGE_MESSAGES", name: "Manage Messages", desc: "Delete others' messages" },
          { key: "CONNECT_VOICE", name: "Connect to Voice", desc: "Join voice channels" },
          { key: "SPEAK", name: "Speak", desc: "Transmit audio in voice" },
          { key: "PIN_MESSAGES", name: "Pin Messages", desc: "Pin messages in channels" },
        ];
        return (
          <div className="profile-modal-overlay" onClick={() => setShowRolesModal(false)}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 750, height: 580, display: "flex", flexDirection: "column", gap: 20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Roles & Permissions</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{activeGuild.name}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowRolesModal(false)}>✕ Close</button>
              </div>
              <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                {(["ROLES", "MEMBERS"] as const).map(tab => (
                  <button key={tab} onClick={() => setRolesTab(tab)}
                    style={{ fontSize: 15, fontWeight: 800, color: rolesTab === tab ? "var(--text)" : "var(--text-muted)", borderBottom: rolesTab === tab ? "2px solid var(--accent)" : "none", paddingBottom: 6, background: "none", border: "none", cursor: "pointer" }}>
                    {tab === "ROLES" ? "🛡️ Manage Roles" : "👥 Member Assignments"}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
                {rolesTab === "ROLES" ? (
                  <>
                    <div style={{ width: 240, borderRight: "1px solid var(--border)", paddingRight: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Roles</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {rolesList.map(role => (
                          <button key={role.id} onClick={() => setSelectedRoleId(role.id)}
                            style={{ justifyContent: "space-between", background: selectedRole?.id === role.id ? "var(--bg-active)" : "transparent", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", width: "100%", color: "var(--text)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: role.color }} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{role.name}</span>
                            </div>
                            {role.name !== "@everyone" && <span style={{ fontSize: 12, opacity: 0.5 }} onClick={(e) => { e.stopPropagation(); void deleteServerRole(role.id); }}>🗑️</span>}
                          </button>
                        ))}
                      </div>
                      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Create Role</div>
                        <input placeholder="Role Name" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 13, marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                          {["#4F7CFF","#8C5EFF","#FF5EAD","#10B981","#F59E0B","#EF4444"].map(col => (
                            <button key={col} onClick={() => setNewRoleColor(col)}
                              style={{ width: 22, height: 22, borderRadius: "50%", background: col, border: newRoleColor === col ? "2px solid #fff" : "none", cursor: "pointer" }} />
                          ))}
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", width: 22, height: 22, borderRadius: "50%", border: "1px dashed var(--border)", background: "rgba(0,0,0,0.2)" }} title="Custom Color">
                            <span style={{ fontSize: 11 }}>🎨</span>
                            <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} style={{ opacity: 0, width: 0, height: 0, padding: 0, border: "none" }} />
                          </label>
                        </div>
                        <button className="btn btn-primary" style={{ width: "100%", fontSize: 12 }} onClick={addServerRole}>+ Add Role</button>
                      </div>
                    </div>
                    <div style={{ flex: 1, paddingLeft: 20, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                      {selectedRole && (
                        <>
                          <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16, display: "grid", gap: 12 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>Role Settings: {selectedRole.name}</div>
                            
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Role Name</label>
                                <input
                                  value={selectedRole.name}
                                  onChange={(e) => void updateRoleProperties(selectedRole.id, { name: e.target.value })}
                                  disabled={selectedRole.id === "default"}
                                  style={{ width: "100%", padding: "6px 10px", borderRadius: 8, background: "var(--bg-panel)", border: "1px solid var(--border)", color: "#fff", fontSize: 13 }}
                                />
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Role Color</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: selectedRole.color, border: "1px solid var(--border)" }} />
                                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", width: 28, height: 28, borderRadius: "50%", border: "1px dashed var(--border)", background: "rgba(0,0,0,0.2)" }} title="Custom Color">
                                    <span style={{ fontSize: 12 }}>🎨</span>
                                    <input type="color" value={selectedRole.color} onChange={e => void updateRoleProperties(selectedRole.id, { color: e.target.value })} style={{ opacity: 0, width: 0, height: 0, padding: 0, border: "none" }} />
                                  </label>
                                </div>
                              </div>
                            </div>

                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
                              <input
                                type="checkbox"
                                checked={selectedRole.hoist || false}
                                onChange={(e) => void updateRoleProperties(selectedRole.id, { hoist: e.target.checked })}
                                disabled={selectedRole.id === "default"}
                                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                              />
                              <span>Display role members separately from online members (Hoist)</span>
                            </label>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span style={{ width: 14, height: 14, borderRadius: "50%", background: selectedRole.color }} />
                            <div style={{ fontSize: 16, fontWeight: 800 }}>Permissions for {selectedRole.name}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {allPermissions.map(perm => (
                              <div key={perm.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700 }}>{perm.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{perm.desc}</div>
                                </div>
                                <input type="checkbox" checked={selectedRole.permissions?.includes(perm.key) || false}
                                  onChange={() => void toggleRolePerm(selectedRole.id, perm.key)}
                                  style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer" }} />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Assign roles to server members:</div>
                    {guildMembers.map(member => {
                      const userRoles = (activeGuild.memberRoles || {})[member.id] || [];
                      return (
                        <div key={member.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar user={member} size={32} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>{member.displayName ?? member.username}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{member.username}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {rolesList.filter(r => r.name !== "@everyone").map(role => {
                              const has = userRoles.includes(role.id);
                              return (
                                <button key={role.id} onClick={() => void toggleUserRole(member.id, role.id)}
                                  style={{ border: "1px solid " + role.color, background: has ? role.color : "transparent", color: has ? "#fff" : role.color, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {has ? "✓" : "+"} {role.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Group DM Modal ─── */}
      {showGroupDmModal && (
        <div className="profile-modal-overlay" onClick={() => setShowGroupDmModal(false)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 20, padding: 36, width: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Create Group DM</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Start a group conversation with your friends</div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Group Name</label>
              <input placeholder="Squad Chat" value={groupDmName} onChange={e => setGroupDmName(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Add Friends ({groupDmSelected.length} selected)</label>
              <input placeholder="Search users..." value={groupDmSearch} onChange={e => setGroupDmSearch(e.target.value)} />
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {allUsers.filter(u => u.id !== me?.id && (myFriends.includes(u.id) || !myFriends.length) && (!groupDmSearch || u.username.toLowerCase().includes(groupDmSearch.toLowerCase()))).map(u => {
                const selected = groupDmSelected.includes(u.id);
                return (
                  <div key={u.id} onClick={() => setGroupDmSelected(s => selected ? s.filter(id => id !== u.id) : [...s, u.id])}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer", background: selected ? "var(--bg-active)" : "var(--bg-deep)", border: "1px solid " + (selected ? "var(--accent)" : "var(--border)") }}>
                    <Avatar user={u} size={28} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{u.displayName ?? u.username}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.username}</div>
                    </div>
                    {selected && <span style={{ marginLeft: "auto", color: "var(--accent)" }}>✓</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowGroupDmModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={groupDmSelected.length < 2 || !groupDmName.trim()} onClick={() => void createGroupDm()}>
                Create Group ({groupDmSelected.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── User Profile Modal ─── */}
      {selectedUserProfile && (
        <div className="profile-modal-overlay" onClick={() => setSelectedUserProfile(null)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-banner" style={{ background: "linear-gradient(135deg, #4F7CFF, #8C5EFF, #FF5EAD)" }}>
              <div className="profile-avatar-wrap"><Avatar user={selectedUserProfile} size={70} /></div>
            </div>
            <div className="profile-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{selectedUserProfile.displayName ?? selectedUserProfile.username}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{selectedUserProfile.username}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => setSelectedUserProfile(null)} style={{ padding: "4px 8px" }}>✕</button>
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRESENCE_COLORS[(selectedUserProfile.presenceStatus as Presence) || "OFFLINE"] }} />
                <span>{selectedUserProfile.presenceStatus || "OFFLINE"}</span>
                {selectedUserProfile.statusLine && <span>— {selectedUserProfile.statusLine}</span>}
              </div>

              {/* Badges */}
              {selectedUserProfile.userBadges && selectedUserProfile.userBadges.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {selectedUserProfile.userBadges.map((b: any) => {
                    const s = BADGE_STYLE[b.badge?.slug];
                    if (!s) return null;
                    return <span key={b.badge.slug} style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
                  })}
                </div>
              )}

              {/* Blacklist indicator — HR only */}
              {(() => {
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
                    case "HEAD_MODERATOR": return 55;
                    case "TRUST_AND_SAFETY": return 50;
                    case "MODERATOR_PLUS": return 42;
                    case "HEAD_TRAINER": return 45;
                    case "MODERATOR": return 40;
                    case "TRAINER": return 35;
                    case "RECRUITER": return 32;
                    case "TRIAL_MODERATOR": return 30;
                    case "SUPPORT_AGENT": return 25;
                    default: return 0;
                  }
                };
                const isHR = getRoleWeight(me?.role) >= 60;
                const isBlacklisted = selectedUserProfile.staffBlacklisted === true;
                if (!isHR || !isBlacklisted) return null;
                return (
                  <div style={{ marginTop: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🚫</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>STAFF BLACKLISTED</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>This user has been blacklisted from the staff team</div>
                    </div>
                  </div>
                );
              })()}

              {/* Bio */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>About Me</div>
                <div className="profile-bio">{selectedUserProfile.bio || "This user hasn't written a bio yet."}</div>
              </div>

              {/* Server roles */}
              {activeGuild && (() => {
                const assignedRoleIds = (activeGuild.memberRoles || {})[selectedUserProfile.id] || [];
                const userRoles = (activeGuild.roles || []).filter(r => assignedRoleIds.includes(r.id) && r.id !== "default");
                if (!userRoles.length) return null;
                return (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Roles</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {userRoles.map(role => (
                        <span key={role.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-deep)", border: "1px solid " + role.color, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: role.color }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: role.color }} />{role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const isPlatformStaff = me?.role && ["TRIAL_MODERATOR", "MODERATOR", "ADMIN", "MANAGER", "DEVELOPER", "CO_OWNER", "OWNER"].includes(me.role.toUpperCase());
                if (!isPlatformStaff) return null;
                return (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#F59E0B", marginBottom: 6 }}>🛡️ Internal Staff Notes</div>
                    <textarea
                      defaultValue={selectedUserProfile.staffNotes || ""}
                      onBlur={async (e) => {
                        await updateDoc(doc(db, "users", selectedUserProfile.id), { staffNotes: e.target.value });
                      }}
                      placeholder="Type internal staff notes here... (auto-saves on blur)"
                      style={{ width: "100%", minHeight: 60, padding: 8, borderRadius: 8, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "#fff", fontSize: 12, resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>
                );
              })()}

              {selectedUserProfile.id !== me?.id && (
                <div style={{ display: "flex", gap: 10, marginTop: 20, flexDirection: "column" }}>
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={async () => {
                    await ensureDmChannel(selectedUserProfile.username);
                    setActiveGuildId(null); setSelectedUserProfile(null);
                    setActiveChannelId("dm_" + [me?.username || "", selectedUserProfile.username].sort().join("_"));
                  }}>💬 Send Message</button>
                  {!myFriends.includes(selectedUserProfile.id) ? (
                    <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => void sendFriendRequest(selectedUserProfile)}>
                      👥 Send Friend Request
                    </button>
                  ) : (
                    <button className="btn btn-ghost" style={{ width: "100%", color: "var(--success)" }}>✓ Friends</button>
                  )}
                  {!blockedUsers.includes(selectedUserProfile.id) ? (
                    <button className="btn btn-danger" style={{ width: "100%", fontSize: 12 }} onClick={() => void blockUser(selectedUserProfile.id)}>🚫 Block User</button>
                  ) : (
                    <button className="btn btn-ghost" style={{ width: "100%", fontSize: 12 }} onClick={() => void unblockUser(selectedUserProfile.id)}>Unblock</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Context Menu ─── */}
      {contextMenu && contextMenu.message && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(null)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
          <div className="context-menu" onClick={e => e.stopPropagation()}
            style={{ position: "absolute", top: contextMenu.y, left: contextMenu.x, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 4, minWidth: 200, zIndex: 100000 }}>
            <div style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>Message Actions</div>

            <button className="ctx-btn" onClick={() => { setReplyingTo(contextMenu.message!); setContextMenu(null); }}>↱ Reply</button>
            <button className="ctx-btn" onClick={() => { setEmojiTarget(contextMenu.message!.id); setShowEmojiPicker(true); setContextMenu(null); }}>😊 Add Reaction</button>
            <button className="ctx-btn" onClick={() => { void pinMessage(contextMenu.message!); setContextMenu(null); }}>
              {contextMenu.message.pinnedBy ? "📌 Unpin Message" : "📌 Pin Message"}
            </button>
            <button className="ctx-btn" onClick={() => { navigator.clipboard.writeText(contextMenu.message?.content || ""); setContextMenu(null); }}>📋 Copy Text</button>
            <button className="ctx-btn" onClick={() => { openUserProfile(contextMenu.message!.author.id, contextMenu.message!.author); setContextMenu(null); }}>👤 View Profile</button>

            {contextMenu.message.author.id === me?.id && (
              <button className="ctx-btn" onClick={() => void startEditMessage(contextMenu.message!)}>✏️ Edit Message</button>
            )}

            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <button className="ctx-btn ctx-btn-danger" onClick={() => { setReportingMessage(contextMenu.message!); setContextMenu(null); }}>🚩 Report</button>

            {(contextMenu.message.author.id === me?.id || (me?.role && ["TRIAL_MODERATOR","MODERATOR","ADMIN","MANAGER","DEVELOPER","CO_OWNER","OWNER"].includes(me.role))) && (
              <button className="ctx-btn ctx-btn-danger" onClick={() => void deleteMessage(contextMenu.message!)}>🗑️ Delete Message</button>
            )}
          </div>
        </div>
      )}

      {/* ─── Server Context Menu ─── */}
      {serverContextMenu && (
        <div className="context-menu-overlay" onClick={() => setServerContextMenu(null)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
          <div className="context-menu" onClick={e => e.stopPropagation()}
            style={{ position: "absolute", top: serverContextMenu.y, left: serverContextMenu.x, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 4, minWidth: 200, zIndex: 100000 }}>
            <div style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
              {serverContextMenu.guildName}
            </div>
            <button className="ctx-btn" onClick={() => {
              navigator.clipboard.writeText(serverContextMenu.guildId);
              setServerContextMenu(null);
            }}>
              📋 Copy Server ID
            </button>
            {guilds.find(x => x.id === serverContextMenu.guildId)?.ownerId !== me?.id && (
              <button className="ctx-btn ctx-btn-danger" onClick={() => {
                void leaveServer(serverContextMenu.guildId, serverContextMenu.guildName);
              }}>
                🚪 Leave Server
              </button>
            )}
            <button className="ctx-btn ctx-btn-danger" onClick={() => {
              const guildObj = guilds.find(x => x.id === serverContextMenu.guildId);
              if (guildObj) setReportingGuild(guildObj);
              setServerContextMenu(null);
            }}>
              🚩 Report Server
            </button>
          </div>
        </div>
      )}

      {/* ─── Member Context Menu ─── */}
      {memberContextMenu && activeGuild && (
        <div className="context-menu-overlay" onClick={() => setMemberContextMenu(null)}
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 99999 }}>
          <div style={{ position: "absolute", top: memberContextMenu.y, left: memberContextMenu.x, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 4, minWidth: 200, zIndex: 100000 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "4px 8px", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
              {memberContextMenu.user.displayName ?? memberContextMenu.user.username}
            </div>
            <button className="ctx-btn" onClick={() => { openUserProfile(memberContextMenu.userId, memberContextMenu.user); setMemberContextMenu(null); }}>👤 View Profile</button>
            {(() => {
              const myRoles = (activeGuild.memberRoles || {})[me?.id || ""] || [];
              const defaultRole = activeGuild.roles?.find(r => r.id === "default") || { id: "default", permissions: ["SEND_MESSAGES"] };
              const basePerms = [
                ...(defaultRole.permissions || []),
                ...(myRoles.flatMap(rid => activeGuild.roles?.find(r => r.id === rid)?.permissions || []))
              ];
              const myPerms = [...basePerms, ...(me?.role?.toUpperCase() === "DEVELOPER" ? ["ADMINISTRATOR"] : [])];
              const isOwner = activeGuild.ownerId === me?.id;
              const hasKick = isOwner || myPerms.includes("KICK_MEMBERS") || myPerms.includes("ADMINISTRATOR");
              const isSelf = memberContextMenu.userId === me?.id;
              const targetIsOwner = activeGuild.ownerId === memberContextMenu.userId;
              return (
                <>
                  {(isOwner || myPerms.includes("ADMINISTRATOR")) && !isSelf && (
                    <button className="ctx-btn" onClick={() => {
                      setAssignRolesTarget({ userId: memberContextMenu.userId, user: memberContextMenu.user });
                      setMemberContextMenu(null);
                    }}>
                      🎭 Assign Roles
                    </button>
                  )}
                  {isOwner && !isSelf && (
                    <button className="ctx-btn ctx-btn-danger" onClick={() => {
                      void transferOwnership(activeGuild.id, memberContextMenu.userId, memberContextMenu.user.displayName ?? memberContextMenu.user.username);
                      setMemberContextMenu(null);
                    }}>
                      👑 Transfer Ownership
                    </button>
                  )}
                  {hasKick && !isSelf && !targetIsOwner && (
                    <button className="ctx-btn ctx-btn-danger" onClick={() => {
                      void kickMember(activeGuild.id, memberContextMenu.userId, memberContextMenu.user.displayName ?? memberContextMenu.user.username);
                      setMemberContextMenu(null);
                    }}>
                      🚪 Kick Member
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Assign Roles Modal ─── */}
      {assignRolesTarget && activeGuild && (() => {
        const allRoles = (activeGuild.roles || []).filter(r => r.id !== "default");
        const currentRoles: string[] = (activeGuild.memberRoles || {})[assignRolesTarget.userId] || [];
        const toggleRole = async (roleId: string) => {
          const guildRef = doc(db, "guilds", activeGuild.id);
          const snap = await getDoc(guildRef);
          if (!snap.exists()) return;
          const memberRoles: Record<string, string[]> = snap.data().memberRoles || {};
          const existing: string[] = memberRoles[assignRolesTarget.userId] || [];
          memberRoles[assignRolesTarget.userId] = existing.includes(roleId)
            ? existing.filter((r: string) => r !== roleId)
            : [...existing, roleId];
          await updateDoc(guildRef, { memberRoles });
        };
        return (
          <div className="profile-modal-overlay" onClick={() => setAssignRolesTarget(null)}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 400, maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>🎭 Assign Roles</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {assignRolesTarget.user.displayName ?? assignRolesTarget.user.username}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setAssignRolesTarget(null)}>✕</button>
              </div>
              {allRoles.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: 14 }}>
                  No roles yet. Create roles in Roles &amp; Permissions settings first.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allRoles.map(role => {
                    const hasRole = currentRoles.includes(role.id);
                    return (
                      <label key={role.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: hasRole ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)", border: `1px solid ${hasRole ? "var(--accent)" : "var(--border)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                        <input type="checkbox" checked={hasRole} onChange={() => void toggleRole(role.id)}
                          style={{ width: 16, height: 16, accentColor: role.color || "var(--accent)", flexShrink: 0 }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: role.color || "#9ca3af", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{role.name}</span>
                        {hasRole && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>ACTIVE</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}



      {/* ─── Server Report Modal ─── */}
      {reportingGuild && (
        <div className="profile-modal-overlay" onClick={() => setReportingGuild(null)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 440, maxWidth: "100%" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#EF4444", display: "flex", alignItems: "center", gap: 8 }}>🚩 Report Server</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              Reporting the server <strong>{reportingGuild.name}</strong> ({reportingGuild.id}).
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>Reason</label>
              <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}>
                <option value="">-- Select a Reason --</option>
                <option value="HARASSMENT">Harassment, Abuse, or Bullying</option>
                <option value="HATE_SPEECH">Hate Speech or Extremist Content</option>
                <option value="SPAM">Spam, Scams, or Phishing</option>
                <option value="NSFW">Explicit or NSFW Content</option>
                <option value="ILLEGAL_ACTIVITIES">Illegal Activities or Content</option>
                <option value="OTHER">Other Terms of Service Violation</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setReportingGuild(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => void handleReportServer()} style={{ background: "#EF4444", color: "#fff" }}>Submit Report</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Modal ─── */}
      {reportingMessage && (
        <div className="profile-modal-overlay" onClick={() => setReportingMessage(null)}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 440, maxWidth: "100%" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#EF4444", display: "flex", alignItems: "center", gap: 8 }}>🚩 Report Message</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              Reporting a message from <strong>@{reportingMessage.author.displayName ?? reportingMessage.author.username}</strong>.
            </p>
            <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, fontStyle: "italic" }}>
              "{(reportingMessage.editedContent ?? reportingMessage.content).slice(0, 200)}"
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>Reason</label>
              <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}>
                <option value="">-- Select a Reason --</option>
                <option value="HARASSMENT">Harassment, Bullying, or Threats</option>
                <option value="HATE_SPEECH">Hate Speech or Discrimination</option>
                <option value="SPAM">Spam, Phishing, or Scam Links</option>
                <option value="NSFW">Explicit or NSFW Content</option>
                <option value="IMPERSONATION">Impersonation</option>
                <option value="OTHER">Other Rule Violation</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setReportingMessage(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => void handleReportMessage()} style={{ background: "#EF4444", color: "#fff" }}>Submit Report</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Emoji Picker (floating, for reactions) ─── */}
      {showEmojiPicker && emojiTarget !== "INPUT" && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200000 }}
          onClick={e => e.stopPropagation()}>
          <div className="emoji-picker">
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>ADD REACTION</span>
              <button onClick={() => setShowEmojiPicker(false)} style={{ fontSize: 12, color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="emoji-grid">
              {QUICK_EMOJI.map(em => (
                <button key={em} className="emoji-btn" onClick={() => { void sendReaction(emojiTarget, em); setShowEmojiPicker(false); }}>{em}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
