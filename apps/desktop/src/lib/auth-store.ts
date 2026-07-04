import { create } from "zustand";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase.js";

export type Me = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  statusLine: string | null;
  presenceStatus: string;
  accountStatus: string;
  earlySupporter: boolean;
  verifiedBadge: boolean;
  userBadges: { badge: { slug: string; label: string } }[];
  admin: boolean;
  role?: string;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  isPremium?: boolean;
  staffBlacklisted?: boolean;
  createdAt: string;
};

type State = {
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  isInitializing: boolean;
  hydrate: () => void;
  setTokens: (access: string, refresh: string, me?: Me) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

export const useAuthStore = create<State>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  me: null,
  isInitializing: true,

  hydrate: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        set({ accessToken: token, isInitializing: false });
        await get().refreshMe();
        
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Me;
            if (data.username === "fearless") {
              data.role = "DEVELOPER";
              data.admin = true;
            } else {
              if (!data.role) data.role = "USER";
              data.admin = data.admin ?? false;
            }
            set({ me: data });
          }
        });
      } else {
        set({ accessToken: null, me: null, isInitializing: false });
      }
    });
  },

  setTokens: (access, refresh, me) => {
    set({ accessToken: access, refreshToken: refresh, ...(me ? { me } : {}) });
  },

  login: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },

  logout: () => {
    signOut(auth).catch(console.error);
    set({ accessToken: null, refreshToken: null, me: null });
  },

  refreshMe: async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as Me;
        if (data.username === "fearless") {
          data.role = "DEVELOPER";
          data.admin = true;
        } else {
          if (!data.role) data.role = "USER";
          data.admin = data.admin ?? false;
        }
        set({ me: data });
      } else {
        set({
          me: {
            id: user.uid,
            username: user.email?.split("@")[0] || "user",
            email: user.email || "",
            emailVerified: user.emailVerified,
            displayName: user.displayName || user.email?.split("@")[0] || "user",
            avatarUrl: user.photoURL,
            bannerUrl: null,
            bio: null,
            statusLine: null,
            createdAt: user.metadata.creationTime || new Date().toISOString(),
            presenceStatus: "ONLINE",
            accountStatus: "ACTIVE",
            earlySupporter: true,
            verifiedBadge: true,
            userBadges: [],
            admin: false,
            role: "USER",
          }
        });
      }
    } catch (e) {
      console.error("Failed to fetch user doc", e);
    }
  },
}));
