/* ══════════════════════════════════════════════════════════════════════════
   Snapchat Streak Recoverer (SSR) — Cloud Sync Engine
   Bi-directional Real-Time Cloud Sync with Firebase Auth & Cloud Firestore
   Full cross-compatibility with the SSR Android Application
   ══════════════════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyADGLlcIe7CxW4DkhDND7MPH_V6RXbl6hQ",
  projectId: "snap-streak-recover",
  webClientId: "1073400338462-117lvbsvub9gt2bua0akr76avdj4vi4j.apps.googleusercontent.com"
};

class CloudSyncEngine {
  constructor() {
    this.user = null;
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.onStatusChange = null;
  }

  async init() {
    const res = await chrome.storage.local.get(["authUser", "lastSyncTime"]);
    this.user = res.authUser || null;
    this.lastSyncTime = res.lastSyncTime || 0;
    return this.user;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!(this.user && this.user.uid && this.user.idToken);
  }

  /* ────────────────────────── AUTHENTICATION ────────────────────────── */

  async signInWithGoogle() {
    const redirectUri = chrome.identity.getRedirectURL();
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(FIREBASE_CONFIG.webClientId)}&` +
      `response_type=token%20id_token&` +
      `scope=openid%20email%20profile&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `nonce=${encodeURIComponent(nonce)}&` +
      `prompt=select_account`;

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message || "Sign in failed"));
        }
        if (!responseUrl) {
          return reject(new Error("Sign in cancelled by user"));
        }
        try {
          const hash = new URL(responseUrl).hash.substring(1);
          const params = new URLSearchParams(hash);
          const idToken = params.get("id_token");
          if (!idToken) {
            throw new Error("No ID Token returned from Google. Please verify OAuth Redirect URI configuration.");
          }

          // Exchange Google ID Token with Firebase Auth REST API
          const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postBody: `id_token=${idToken}&providerId=google.com`,
              requestUri: redirectUri,
              returnIdpCredential: true,
              returnSecureToken: true
            })
          });

          const data = await fbRes.json();
          if (data.error) {
            throw new Error(data.error.message || "Firebase Auth failed");
          }

          this.user = {
            uid: data.localId,
            email: data.email,
            displayName: data.displayName || data.email?.split("@")[0] || "User",
            photoUrl: data.photoUrl || "",
            idToken: data.idToken,
            refreshToken: data.refreshToken,
            expiresAt: Date.now() + (parseInt(data.expiresIn || "3600", 10) * 1000)
          };

          await chrome.storage.local.set({ authUser: this.user });
          if (this.onStatusChange) this.onStatusChange(this.user);
          resolve(this.user);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async signOut() {
    this.user = null;
    await chrome.storage.local.remove(["authUser", "lastSyncTime"]);
    if (this.onStatusChange) this.onStatusChange(null);
  }

  async getValidToken() {
    if (!this.user) return null;
    // Refresh 2 minutes before expiry
    if (Date.now() >= (this.user.expiresAt - 120000)) {
      try {
        const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.user.refreshToken)}`
        });
        const data = await res.json();
        if (data.id_token) {
          this.user.idToken = data.id_token;
          this.user.refreshToken = data.refresh_token;
          this.user.expiresAt = Date.now() + (parseInt(data.expires_in || "3600", 10) * 1000);
          await chrome.storage.local.set({ authUser: this.user });
        }
      } catch (e) {
        console.warn("Token refresh failed:", e);
      }
    }
    return this.user.idToken;
  }

  /* ────────────────────────── FIRESTORE REST HELPERS ────────────────────────── */

  encodeField(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number") {
      return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
    }
    if (typeof val === "string") return { stringValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(v => this.encodeField(v)) } };
    if (typeof val === "object") {
      const fields = {};
      for (const k in val) fields[k] = this.encodeField(val[k]);
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  decodeDoc(doc) {
    if (!doc || !doc.fields) return null;
    const res = {};
    for (const k in doc.fields) {
      res[k] = this.decodeValue(doc.fields[k]);
    }
    return res;
  }

  decodeValue(f) {
    if (!f) return null;
    if ("stringValue" in f) return f.stringValue;
    if ("booleanValue" in f) return f.booleanValue;
    if ("integerValue" in f) return parseInt(f.integerValue, 10);
    if ("doubleValue" in f) return f.doubleValue;
    if ("nullValue" in f) return null;
    if ("arrayValue" in f) return (f.arrayValue?.values || []).map(v => this.decodeValue(v));
    if ("mapValue" in f) {
      const obj = {};
      for (const k in f.mapValue?.fields || {}) obj[k] = this.decodeValue(f.mapValue.fields[k]);
      return obj;
    }
    return null;
  }

  /* ────────────────────────── BI-DIRECTIONAL SYNC ────────────────────────── */

  async sync(dataManager) {
    if (!this.isAuthenticated() || this.isSyncing) return false;
    this.isSyncing = true;
    try {
      const token = await this.getValidToken();
      if (!token) throw new Error("Authentication token expired. Please sign in again.");

      const uid = this.user.uid;
      const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}`;

      // 1. Fetch remote profiles
      const profRes = await fetch(`${baseDocUrl}/profiles`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      let remoteProfiles = [];
      if (profRes.ok) {
        const profData = await profRes.json();
        remoteProfiles = (profData.documents || []).map(d => this.decodeDoc(d)).filter(Boolean);
      } else if (profRes.status !== 404) {
        const err = await profRes.json();
        throw new Error(err.error?.message || "Failed to fetch remote profiles");
      }

      // Map remote profiles by syncId
      const remoteMap = new Map();
      for (const rp of remoteProfiles) {
        if (rp.syncId) remoteMap.set(rp.syncId, rp);
      }

      // 2. Reconcile Local Profiles
      let localModified = false;
      const localProfiles = dataManager.profiles;

      for (const [profName, localProf] of Object.entries(localProfiles)) {
        if (!localProf.syncId) {
          localProf.syncId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : "ext-p-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
          localModified = true;
        }
        if (!localProf.updatedAt) {
          localProf.updatedAt = Date.now();
          localModified = true;
        }

        const remote = remoteMap.get(localProf.syncId);
        if (!remote) {
          // Profile exists locally but not in remote -> push to remote
          await this.pushRemoteProfile(uid, token, localProf.syncId, profName, localProf);
        } else if (remote.isDeleted) {
          // Remote marked deleted -> delete locally
          delete localProfiles[profName];
          localModified = true;
          continue;
        } else if ((remote.updatedAt || 0) > (localProf.updatedAt || 0)) {
          // Remote is newer -> update local
          localProf.settings = {
            username: remote.snapchatUsername || "",
            email: remote.email || "",
            mobile_number: remote.mobileNumber || "",
            device: remote.device || "",
            refresh_delay: remote.refreshDelay || 1.0
          };
          localProf.updatedAt = remote.updatedAt;
          localModified = true;
        } else if ((localProf.updatedAt || 0) > (remote.updatedAt || 0)) {
          // Local is newer -> push to remote
          await this.pushRemoteProfile(uid, token, localProf.syncId, profName, localProf);
        }

        // Sync friends for this profile
        const friendsModified = await this.syncFriendsForProfile(uid, token, localProf.syncId, localProf);
        if (friendsModified) localModified = true;
      }

      // 3. Add remote profiles that don't exist locally
      for (const [syncId, rp] of remoteMap.entries()) {
        if (rp.isDeleted) continue;
        const existsLocally = Object.values(localProfiles).some(lp => lp.syncId === syncId);
        if (!existsLocally) {
          let profileKey = rp.profileName || rp.snapchatUsername || ("Profile " + syncId.substring(0, 4));
          // If name collision, append a number
          let counter = 1;
          const origKey = profileKey;
          while (localProfiles[profileKey]) {
            profileKey = `${origKey} (${counter++})`;
          }

          localProfiles[profileKey] = {
            syncId: rp.syncId,
            settings: {
              username: rp.snapchatUsername || "",
              email: rp.email || "",
              mobile_number: rp.mobileNumber || "",
              device: rp.device || "",
              refresh_delay: rp.refreshDelay || 1.0
            },
            friends: [],
            updatedAt: rp.updatedAt || Date.now()
          };
          // Fetch its friends
          await this.syncFriendsForProfile(uid, token, rp.syncId, localProfiles[profileKey]);
          localModified = true;
        }
      }

      if (localModified) {
        if (!dataManager.currentProfile || !localProfiles[dataManager.currentProfile]) {
          dataManager.currentProfile = Object.keys(localProfiles)[0] || null;
        }
        await dataManager.saveProfiles();
      }

      this.lastSyncTime = Date.now();
      await chrome.storage.local.set({ lastSyncTime: this.lastSyncTime });
      return true;
    } catch (e) {
      console.error("Cloud sync error:", e);
      throw e;
    } finally {
      this.isSyncing = false;
    }
  }

  async syncFriendsForProfile(uid, token, profileSyncId, localProf) {
    let modified = false;
    const friendsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/profiles/${profileSyncId}/friends`;
    const fRes = await fetch(friendsUrl, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    let remoteFriends = [];
    if (fRes.ok) {
      const data = await fRes.json();
      remoteFriends = (data.documents || []).map(d => this.decodeDoc(d)).filter(Boolean);
    }

    const remoteFriendMap = new Map();
    for (const rf of remoteFriends) {
      if (rf.syncId) remoteFriendMap.set(rf.syncId, rf);
    }

    if (!localProf.friends) localProf.friends = [];

    // Reconcile local friends
    for (const lf of localProf.friends) {
      if (!lf.syncId) {
        lf.syncId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : "ext-f-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        modified = true;
      }
      if (!lf.updatedAt) {
        lf.updatedAt = Date.now();
        modified = true;
      }

      const rf = remoteFriendMap.get(lf.syncId);
      if (!rf) {
        await this.pushRemoteFriend(uid, token, profileSyncId, lf.syncId, lf);
      } else if (rf.isDeleted) {
        lf._deleted = true;
        modified = true;
      } else if ((rf.updatedAt || 0) > (lf.updatedAt || 0)) {
        lf.name = rf.displayName || lf.name || rf.username;
        lf.username = rf.username || lf.username;
        lf.selected = rf.isSelected !== false;
        lf.updatedAt = rf.updatedAt;
        modified = true;
      } else if ((lf.updatedAt || 0) > (rf.updatedAt || 0)) {
        await this.pushRemoteFriend(uid, token, profileSyncId, lf.syncId, lf);
      }
    }

    // Filter out deleted friends
    if (localProf.friends.some(f => f._deleted)) {
      localProf.friends = localProf.friends.filter(f => !f._deleted);
      modified = true;
    }

    // Add new remote friends
    for (const [syncId, rf] of remoteFriendMap.entries()) {
      if (rf.isDeleted) continue;
      const hasLocal = localProf.friends.some(f => f.syncId === syncId || (f.username && f.username.toLowerCase() === (rf.username || "").toLowerCase()));
      if (!hasLocal) {
        localProf.friends.push({
          syncId: rf.syncId,
          name: rf.displayName || rf.username,
          username: rf.username,
          selected: rf.isSelected !== false,
          updatedAt: rf.updatedAt || Date.now()
        });
        modified = true;
      }
    }

    return modified;
  }

  async pushRemoteProfile(uid, token, syncId, profileName, prof) {
    const s = prof.settings || {};
    const body = {
      fields: {
        syncId: this.encodeField(syncId),
        profileName: this.encodeField(profileName),
        snapchatUsername: this.encodeField(s.username || ""),
        email: this.encodeField(s.email || ""),
        mobileNumber: this.encodeField(s.mobile_number || ""),
        device: this.encodeField(s.device || "Chrome Extension"),
        refreshDelay: this.encodeField(parseFloat(s.refresh_delay) || 1.0),
        updatedAt: this.encodeField(prof.updatedAt || Date.now()),
        isDeleted: this.encodeField(false)
      }
    };
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/profiles/${syncId}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async pushRemoteFriend(uid, token, profileSyncId, friendSyncId, friend) {
    const body = {
      fields: {
        syncId: this.encodeField(friendSyncId),
        profileSyncId: this.encodeField(profileSyncId),
        username: this.encodeField(friend.username || ""),
        displayName: this.encodeField(friend.name || friend.username || ""),
        isSelected: this.encodeField(friend.selected !== false),
        updatedAt: this.encodeField(friend.updatedAt || Date.now()),
        isDeleted: this.encodeField(false)
      }
    };
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${uid}/profiles/${profileSyncId}/friends/${friendSyncId}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async markProfileDeleted(syncId) {
    if (!this.isAuthenticated() || !syncId) return;
    try {
      const token = await this.getValidToken();
      if (!token) return;
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${this.user.uid}/profiles/${syncId}?updateMask.fieldPaths=isDeleted&updateMask.fieldPaths=updatedAt`;
      await fetch(url, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            isDeleted: this.encodeField(true),
            updatedAt: this.encodeField(Date.now())
          }
        })
      });
    } catch (e) {
      console.warn("Failed to mark remote profile deleted:", e);
    }
  }

  async markFriendDeleted(profileSyncId, friendSyncId) {
    if (!this.isAuthenticated() || !profileSyncId || !friendSyncId) return;
    try {
      const token = await this.getValidToken();
      if (!token) return;
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${this.user.uid}/profiles/${profileSyncId}/friends/${friendSyncId}?updateMask.fieldPaths=isDeleted&updateMask.fieldPaths=updatedAt`;
      await fetch(url, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            isDeleted: this.encodeField(true),
            updatedAt: this.encodeField(Date.now())
          }
        })
      });
    } catch (e) {
      console.warn("Failed to mark remote friend deleted:", e);
    }
  }
}

// Global singleton instance
const cloudSync = new CloudSyncEngine();
