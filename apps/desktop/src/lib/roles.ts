/**
 * Lensly Staff Role Hierarchy & Permissions
 * Single source of truth for all role definitions, weights, and permissions.
 */

export type RoleKey =
  | "OWNER"
  | "CO_OWNER"
  | "EXECUTIVE_DIRECTOR"
  | "HEAD_OF_STAFF"
  | "SENIOR_ADMIN"
  | "ADMIN"
  | "HEAD_MODERATOR"
  | "MODERATOR"
  | "TRIAL_MODERATOR"
  | "HEAD_TRAINER"
  | "TRAINER"
  | "RECRUITER"
  | "SUPPORT_AGENT"
  | "TRUST_AND_SAFETY"
  // Legacy keys kept for backward compat
  | "DEVELOPER"
  | "MANAGER"
  | "MODERATOR_PLUS";

export type Permission =
  // --- Platform / System ---
  | "MANAGE_SYSTEM_CONFIG"       // Toggle maintenance mode, registrations, dev mode
  | "VIEW_SYSTEM_CONFIG"         // Read system config
  | "MANAGE_UPDATES"             // Push staged updates & changelogs
  | "VIEW_STATS"                 // See platform-wide stats
  // --- Staff Management ---
  | "GRANT_STAFF_ROLES"          // Assign any staff role
  | "REVOKE_STAFF_ROLES"         // Remove staff roles
  | "BLACKLIST_STAFF"            // Blacklist a staff member
  | "VIEW_STAFF"                 // See staff list
  | "MANAGE_APPLICATIONS"        // Accept / reject applications
  | "VIEW_APPLICATIONS"          // Read applications
  | "TRAIN_STAFF"                // Run training sessions
  | "RECRUIT_STAFF"              // Review applications and recruit
  // --- User Management ---
  | "BAN_USERS"                  // Permanently ban users
  | "TEMP_BAN_USERS"             // Temporary bans
  | "SUSPEND_USERS"              // Suspend accounts
  | "WARN_USERS"                 // Issue warnings
  | "MUTE_USERS"                 // Mute users
  | "KICK_GUILD_MEMBERS"         // Kick from servers
  | "DELETE_MESSAGES"            // Delete any message
  | "VIEW_USER_PROFILES"         // See full admin user profiles
  | "EDIT_USER_PROFILES"         // Edit user info (admin)
  | "MANAGE_PREMIUM"             // Grant / revoke premium
  | "MANAGE_BADGES"              // Grant / revoke badges
  | "MANAGE_GUILDS"              // Suspend / delete servers
  | "IP_BAN"                     // IP-level bans
  | "HWID_BAN"                   // Hardware-ID bans
  // --- Support & Safety ---
  | "MANAGE_TICKETS"             // Handle support tickets
  | "VIEW_TICKETS"               // Read tickets
  | "MANAGE_REPORTS"             // Resolve user reports
  | "VIEW_REPORTS"               // Read reports
  | "TRUST_AND_SAFETY_ACTIONS"   // Handle abuse/scam/safety reports
  // --- Moderation ---
  | "VIEW_MOD_LOG"               // See moderation history
  | "MANAGE_MOD_LOG"             // Edit / delete mod log entries
  | "SEND_PLATFORM_MESSAGES"     // Send global Lensly system messages
  | "VIEW_ADMIN_PANEL"           // Access the admin panel at all
  // --- Discord Sync ---
  | "MANAGE_DISCORD_SYNC"        // Sync Discord roles via bot
  | "MANAGE_GUILD_DISCOVERY";    // Approve / reject guild discovery

export interface RoleDef {
  key: RoleKey;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  weight: number;           // Higher = more authority
  category: string;
  description: string;
  permissions: Permission[];
}

// ─── Permission sets (reusable) ──────────────────────────────────────────────

const BASE_STAFF: Permission[] = [
  "VIEW_ADMIN_PANEL",
  "VIEW_USER_PROFILES",
  "VIEW_MOD_LOG",
  "VIEW_REPORTS",
  "VIEW_TICKETS",
  "VIEW_STATS",
  "VIEW_STAFF",
];

const TRIAL_MOD_PERMS: Permission[] = [
  ...BASE_STAFF,
  "WARN_USERS",
  "MUTE_USERS",
  "DELETE_MESSAGES",
];

const MOD_PERMS: Permission[] = [
  ...TRIAL_MOD_PERMS,
  "KICK_GUILD_MEMBERS",
  "TEMP_BAN_USERS",
  "MANAGE_REPORTS",
  "VIEW_APPLICATIONS",
];

const HEAD_MOD_PERMS: Permission[] = [
  ...MOD_PERMS,
  "BAN_USERS",
  "SUSPEND_USERS",
  "MANAGE_TICKETS",
  "MANAGE_MOD_LOG",
];

const SUPPORT_PERMS: Permission[] = [
  ...BASE_STAFF,
  "MANAGE_TICKETS",
  "VIEW_USER_PROFILES",
  "WARN_USERS",
];

const TRUST_SAFETY_PERMS: Permission[] = [
  ...BASE_STAFF,
  "MANAGE_REPORTS",
  "TRUST_AND_SAFETY_ACTIONS",
  "BAN_USERS",
  "SUSPEND_USERS",
  "IP_BAN",
];

const TRAINER_PERMS: Permission[] = [
  ...BASE_STAFF,
  "VIEW_APPLICATIONS",
  "TRAIN_STAFF",
];

const HEAD_TRAINER_PERMS: Permission[] = [
  ...TRAINER_PERMS,
  "MANAGE_APPLICATIONS",
  "RECRUIT_STAFF",
];

const RECRUITER_PERMS: Permission[] = [
  ...BASE_STAFF,
  "VIEW_APPLICATIONS",
  "MANAGE_APPLICATIONS",
  "RECRUIT_STAFF",
];

const ADMIN_PERMS: Permission[] = [
  ...HEAD_MOD_PERMS,
  "EDIT_USER_PROFILES",
  "MANAGE_BADGES",
  "MANAGE_PREMIUM",
  "MANAGE_GUILDS",
  "MANAGE_GUILD_DISCOVERY",
  "SEND_PLATFORM_MESSAGES",
  "MANAGE_APPLICATIONS",
  "VIEW_SYSTEM_CONFIG",
];

const SENIOR_ADMIN_PERMS: Permission[] = [
  ...ADMIN_PERMS,
  "GRANT_STAFF_ROLES",
  "REVOKE_STAFF_ROLES",
  "IP_BAN",
  "HWID_BAN",
  "MANAGE_DISCORD_SYNC",
  "MANAGE_UPDATES",
];

const HEAD_OF_STAFF_PERMS: Permission[] = [
  ...SENIOR_ADMIN_PERMS,
  "BLACKLIST_STAFF",
  "MANAGE_SYSTEM_CONFIG",
];

const EXEC_DIRECTOR_PERMS: Permission[] = [
  ...HEAD_OF_STAFF_PERMS,
];

const CO_OWNER_PERMS: Permission[] = [
  ...EXEC_DIRECTOR_PERMS,
];

const OWNER_PERMS: Permission[] = [
  ...CO_OWNER_PERMS,
];

// ─── Role Definitions ─────────────────────────────────────────────────────────

export const ROLES: RoleDef[] = [
  {
    key: "OWNER",
    label: "Owner",
    emoji: "👑",
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.15)",
    weight: 100,
    category: "Ownership",
    description: "Full control over Lensly, including all systems, staff, and decisions.",
    permissions: OWNER_PERMS,
  },
  {
    key: "CO_OWNER",
    label: "Co-Owner",
    emoji: "🤝",
    color: "#F97316",
    bgColor: "rgba(249,115,22,0.15)",
    weight: 90,
    category: "Ownership",
    description: "Assists the Owner with managing the platform and operations.",
    permissions: CO_OWNER_PERMS,
  },
  {
    key: "EXECUTIVE_DIRECTOR",
    label: "Executive Director",
    emoji: "🧾",
    color: "#A78BFA",
    bgColor: "rgba(167,139,250,0.15)",
    weight: 85,
    category: "Leadership",
    description: "Oversees departments, staff management, and platform operations.",
    permissions: EXEC_DIRECTOR_PERMS,
  },
  {
    key: "HEAD_OF_STAFF",
    label: "Head of Staff",
    emoji: "🏆",
    color: "#818CF8",
    bgColor: "rgba(129,140,248,0.15)",
    weight: 80,
    category: "Leadership",
    description: "Oversees all staff teams and reports directly to Ownership.",
    permissions: HEAD_OF_STAFF_PERMS,
  },
  {
    key: "SENIOR_ADMIN",
    label: "Senior Administrator",
    emoji: "🧩",
    color: "#6366F1",
    bgColor: "rgba(99,102,241,0.15)",
    weight: 75,
    category: "Administration",
    description: "Handles high-level moderation decisions and staff supervision.",
    permissions: SENIOR_ADMIN_PERMS,
  },
  {
    key: "ADMIN",
    label: "Administrator",
    emoji: "⚖️",
    color: "#EC4899",
    bgColor: "rgba(236,72,153,0.15)",
    weight: 65,
    category: "Administration",
    description: "Manages moderators, supports enforcement actions, and handles escalated issues.",
    permissions: ADMIN_PERMS,
  },
  {
    key: "HEAD_MODERATOR",
    label: "Head Moderator",
    emoji: "🛡️",
    color: "#3B82F6",
    bgColor: "rgba(59,130,246,0.15)",
    weight: 55,
    category: "Moderation",
    description: "Leads the moderation team and handles serious cases.",
    permissions: HEAD_MOD_PERMS,
  },
  {
    key: "MODERATOR",
    label: "Moderator",
    emoji: "🔨",
    color: "#60A5FA",
    bgColor: "rgba(96,165,250,0.15)",
    weight: 40,
    category: "Moderation",
    description: "Enforces community rules, reviews reports, and moderates content.",
    permissions: MOD_PERMS,
  },
  {
    key: "TRIAL_MODERATOR",
    label: "Trial Moderator",
    emoji: "👀",
    color: "#93C5FD",
    bgColor: "rgba(147,197,253,0.15)",
    weight: 30,
    category: "Moderation",
    description: "A moderator in training with limited permissions.",
    permissions: TRIAL_MOD_PERMS,
  },
  {
    key: "TRUST_AND_SAFETY",
    label: "Trust & Safety",
    emoji: "🔒",
    color: "#10B981",
    bgColor: "rgba(16,185,129,0.15)",
    weight: 50,
    category: "Support & Safety",
    description: "Reviews reports involving abuse, scams, impersonation, and other safety concerns.",
    permissions: TRUST_SAFETY_PERMS,
  },
  {
    key: "SUPPORT_AGENT",
    label: "Support Agent",
    emoji: "🎫",
    color: "#06B6D4",
    bgColor: "rgba(6,182,212,0.15)",
    weight: 25,
    category: "Support & Safety",
    description: "Assists users with support tickets and account issues.",
    permissions: SUPPORT_PERMS,
  },
  {
    key: "HEAD_TRAINER",
    label: "Head Trainer",
    emoji: "🎓",
    color: "#84CC16",
    bgColor: "rgba(132,204,22,0.15)",
    weight: 45,
    category: "Training",
    description: "Leads training programs for staff.",
    permissions: HEAD_TRAINER_PERMS,
  },
  {
    key: "TRAINER",
    label: "Trainer",
    emoji: "🧑‍🏫",
    color: "#A3E635",
    bgColor: "rgba(163,230,53,0.15)",
    weight: 35,
    category: "Training",
    description: "Trains and mentors new team members.",
    permissions: TRAINER_PERMS,
  },
  {
    key: "RECRUITER",
    label: "Recruiter",
    emoji: "📋",
    color: "#FB923C",
    bgColor: "rgba(251,146,60,0.15)",
    weight: 32,
    category: "Training",
    description: "Reviews applications and recruits new staff.",
    permissions: RECRUITER_PERMS,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ROLE_MAP: Record<string, RoleDef> = Object.fromEntries(
  ROLES.map((r) => [r.key, r])
);

export function getRoleWeight(role?: string | null): number {
  return ROLE_MAP[role?.toUpperCase() ?? ""]?.weight ?? 0;
}

export function getRoleDef(role?: string | null): RoleDef | undefined {
  return ROLE_MAP[role?.toUpperCase() ?? ""];
}

export function hasPermission(role: string | undefined | null, perm: Permission): boolean {
  const def = getRoleDef(role);
  return def?.permissions.includes(perm) ?? false;
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  MANAGE_SYSTEM_CONFIG:     "Manage System Config",
  VIEW_SYSTEM_CONFIG:       "View System Config",
  MANAGE_UPDATES:           "Push Updates & Changelogs",
  VIEW_STATS:               "View Platform Stats",
  GRANT_STAFF_ROLES:        "Grant Staff Roles",
  REVOKE_STAFF_ROLES:       "Revoke Staff Roles",
  BLACKLIST_STAFF:          "Blacklist Staff Members",
  VIEW_STAFF:               "View Staff List",
  MANAGE_APPLICATIONS:      "Manage Applications",
  VIEW_APPLICATIONS:        "View Applications",
  TRAIN_STAFF:              "Train Staff",
  RECRUIT_STAFF:            "Recruit Staff",
  BAN_USERS:                "Permanently Ban Users",
  TEMP_BAN_USERS:           "Temporarily Ban Users",
  SUSPEND_USERS:            "Suspend Accounts",
  WARN_USERS:               "Issue Warnings",
  MUTE_USERS:               "Mute Users",
  KICK_GUILD_MEMBERS:       "Kick Server Members",
  DELETE_MESSAGES:          "Delete Messages",
  VIEW_USER_PROFILES:       "View User Profiles",
  EDIT_USER_PROFILES:       "Edit User Profiles",
  MANAGE_PREMIUM:           "Manage Premium",
  MANAGE_BADGES:            "Manage Badges",
  MANAGE_GUILDS:            "Manage Servers",
  IP_BAN:                   "IP Ban",
  HWID_BAN:                 "Hardware ID Ban",
  MANAGE_TICKETS:           "Manage Support Tickets",
  VIEW_TICKETS:             "View Support Tickets",
  MANAGE_REPORTS:           "Handle Reports",
  VIEW_REPORTS:             "View Reports",
  TRUST_AND_SAFETY_ACTIONS: "Trust & Safety Actions",
  VIEW_MOD_LOG:             "View Moderation Log",
  MANAGE_MOD_LOG:           "Edit Moderation Log",
  SEND_PLATFORM_MESSAGES:   "Send Platform Messages",
  VIEW_ADMIN_PANEL:         "Access Admin Panel",
  MANAGE_DISCORD_SYNC:      "Manage Discord Sync",
  MANAGE_GUILD_DISCOVERY:   "Manage Guild Discovery",
};

export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  {
    label: "Platform",
    perms: ["VIEW_ADMIN_PANEL", "VIEW_STATS", "VIEW_SYSTEM_CONFIG", "MANAGE_SYSTEM_CONFIG", "MANAGE_UPDATES", "SEND_PLATFORM_MESSAGES"],
  },
  {
    label: "Staff",
    perms: ["VIEW_STAFF", "GRANT_STAFF_ROLES", "REVOKE_STAFF_ROLES", "BLACKLIST_STAFF", "VIEW_APPLICATIONS", "MANAGE_APPLICATIONS", "TRAIN_STAFF", "RECRUIT_STAFF"],
  },
  {
    label: "User Actions",
    perms: ["VIEW_USER_PROFILES", "EDIT_USER_PROFILES", "WARN_USERS", "MUTE_USERS", "KICK_GUILD_MEMBERS", "TEMP_BAN_USERS", "SUSPEND_USERS", "BAN_USERS", "IP_BAN", "HWID_BAN", "DELETE_MESSAGES", "MANAGE_PREMIUM", "MANAGE_BADGES"],
  },
  {
    label: "Servers",
    perms: ["MANAGE_GUILDS", "MANAGE_GUILD_DISCOVERY"],
  },
  {
    label: "Tickets & Reports",
    perms: ["VIEW_TICKETS", "MANAGE_TICKETS", "VIEW_REPORTS", "MANAGE_REPORTS", "TRUST_AND_SAFETY_ACTIONS"],
  },
  {
    label: "Moderation Log",
    perms: ["VIEW_MOD_LOG", "MANAGE_MOD_LOG"],
  },
  {
    label: "Integrations",
    perms: ["MANAGE_DISCORD_SYNC"],
  },
];
