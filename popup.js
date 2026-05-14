/* Snapchat Streak Recoverer — Chrome Extension Popup Logic */

// ═══════════════════ CONSTANTS ═══════════════════
const VERSION = "1.01";
const APP_NAME = "Snapchat Streak Recoverer";
const DEVELOPER = "Abdul Haseeb";
const GITHUB_URL = "https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension";
const FORM_URL = "https://help.snapchat.com/hc/en-us/requests/new?co=true&ticket_form_id=149423";
const DEFAULT_PROFILE = { username: "", email: "", mobile_number: "", device: "", refresh_delay: 1.0 };
const DEFAULT_APP = { appearance_mode: "Dark", view_mode: "Grid", overlay_position: "Top" };

// ═══════════════════ DATA MANAGER ═══════════════════
class DataManager {
  constructor() {
    this.profiles = {};
    this.currentProfile = null;
    this.appSettings = { ...DEFAULT_APP };
  }

  async load() {
    const data = await chrome.storage.local.get(["profiles", "currentProfile", "appSettings"]);
    this.profiles = data.profiles || {};
    this.currentProfile = data.currentProfile || Object.keys(this.profiles)[0] || null;
    this.appSettings = { ...DEFAULT_APP, ...data.appSettings };
  }

  async saveProfiles() {
    await chrome.storage.local.set({ profiles: this.profiles, currentProfile: this.currentProfile });
  }

  async saveAppSettings() {
    await chrome.storage.local.set({ appSettings: this.appSettings });
  }

  getFriends() {
    if (!this.currentProfile || !this.profiles[this.currentProfile]) return [];
    return this.profiles[this.currentProfile].friends || [];
  }

  getSettings() {
    if (!this.currentProfile || !this.profiles[this.currentProfile]) return {};
    return this.profiles[this.currentProfile].settings || {};
  }

  addProfile(name, settings) {
    if (this.profiles[name]) return false;
    this.profiles[name] = { settings: settings || { ...DEFAULT_PROFILE }, friends: [] };
    return true;
  }

  deleteProfile(name) {
    delete this.profiles[name];
    if (this.currentProfile === name)
      this.currentProfile = Object.keys(this.profiles)[0] || null;
  }

  addFriend(username, name) {
    const friends = this.getFriends();
    if (friends.some(f => f.username.toLowerCase() === username.toLowerCase())) return false;
    friends.push({ username, name, selected: true });
    return true;
  }

  getSelectedFriends() {
    return this.getFriends().filter(f => f.selected).map(f => f.username);
  }

  getSelectedCount() {
    return this.getFriends().filter(f => f.selected).length;
  }
}

// ═══════════════════ GLOBALS ═══════════════════
const data = new DataManager();
let searchQuery = "";
let filterSelectedOnly = false;
let sessionFailures = [];

// ═══════════════════ INIT ═══════════════════
document.addEventListener("DOMContentLoaded", async () => {
  await data.load();
  applyTheme();
  refreshUI();
  bindEvents();
});

function applyTheme() {
  const mode = data.appSettings.appearance_mode || "Dark";
  if (mode === "Light") document.documentElement.setAttribute("data-theme", "light");
  else if (mode === "Dark") document.documentElement.removeAttribute("data-theme");
  else {
    if (window.matchMedia("(prefers-color-scheme: light)").matches)
      document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  }
}

// ═══════════════════ EVENT BINDING ═══════════════════
function bindEvents() {
  $("#btn-profile").addEventListener("click", openProfileMenu);
  $("#btn-settings").addEventListener("click", openSettingsModal);
  $("#btn-select-all").addEventListener("click", () => bulkSelect(true));
  $("#btn-deselect-all").addEventListener("click", () => bulkSelect(false));
  $("#selection-counter").addEventListener("click", toggleSelectedFilter);
  $("#search-input").addEventListener("input", e => { searchQuery = e.target.value.toLowerCase().trim(); renderFriends(); });
  $("#btn-add-friend").addEventListener("click", addFriend);
  $("#btn-recover").addEventListener("click", startRecovery);
  $("#input-friend-username").addEventListener("keydown", e => { if (e.key === "Enter") addFriend(); });
}

function $(sel) { return document.querySelector(sel); }

function toggleSelectedFilter() {
  filterSelectedOnly = !filterSelectedOnly;
  $("#selection-counter").classList.toggle("filtering", filterSelectedOnly);
  renderFriends();
}

// ═══════════════════ FULL UI REFRESH ═══════════════════
function refreshUI() {
  const btn = $("#btn-profile");
  if (data.currentProfile) {
    btn.textContent = data.currentProfile[0].toUpperCase();
    $("#btn-recover").disabled = false;
  } else {
    btn.textContent = "+";
    $("#btn-recover").disabled = true;
  }
  const label = data.currentProfile ? `Friends (${data.currentProfile})` : "My Friends";
  $("#friends-label").textContent = label;
  renderFriends();
}

// ═══════════════════ RENDER FRIENDS ═══════════════════
function renderFriends() {
  const list = $("#friends-list");
  const allFriends = data.getFriends();
  const isGrid = data.appSettings.view_mode === "Grid";

  list.className = isGrid ? "friends-grid" : "friends-list-view";

  let indexed = allFriends.map((f, i) => ({ f, i }));
  if (searchQuery) {
    indexed = indexed.filter(({ f }) =>
      f.username.toLowerCase().includes(searchQuery) ||
      (f.name || "").toLowerCase().includes(searchQuery)
    );
  }

  if (filterSelectedOnly) {
    indexed = indexed.filter(({ f }) => f.selected);
  }

  updateCounter(indexed.length, allFriends.length);

  if (indexed.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">👻</span><p>${allFriends.length ? "No matches" : "No friends added yet"}</p><p class="empty-hint">${allFriends.length ? "Try a different search" : "Add a friend below to get started"}</p></div>`;
    return;
  }

  list.innerHTML = indexed.map(({ f, i }) => isGrid ? gridCard(f, i) : listRow(f, i)).join("");

  // Bind events
  list.querySelectorAll("[data-toggle]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); toggleFriend(+el.dataset.toggle); });
  });
  list.querySelectorAll("[data-open]").forEach(el => {
    el.addEventListener("dblclick", () => openEditFriend(+el.dataset.open));
  });
  list.querySelectorAll("[data-edit]").forEach(el => {
    el.addEventListener("click", e => { e.stopPropagation(); openEditFriend(+el.dataset.edit); });
  });
}

function gridCard(f, i) {
  const sel = f.selected;
  const name = f.name || f.username;
  const display = name.length > 20 ? name.slice(0, 17) + "..." : name;
  const uname = f.name && f.name !== f.username ? `<div class="friend-username">@${f.username.length > 22 ? f.username.slice(0, 19) + "..." : f.username}</div>` : "";
  return `<div class="friend-card ${sel ? "is-selected" : ""}" data-open="${i}"><div class="card-header"><span class="checkbox-custom ${sel ? "checked" : ""}" data-toggle="${i}"></span><span class="friend-name">${esc(display)}</span></div>${uname}</div>`;
}

function listRow(f, i) {
  const sel = f.selected;
  const name = f.name || f.username;
  const uname = f.name && f.name !== f.username ? `<div class="friend-username">@${esc(f.username)}</div>` : "";
  return `<div class="friend-row ${sel ? "is-selected" : ""}" data-open="${i}"><span class="checkbox-custom ${sel ? "checked" : ""}" data-toggle="${i}"></span><div class="row-info"><div class="friend-name">${esc(name)}</div>${uname}</div><button class="row-edit-btn" data-edit="${i}">✎ Edit</button></div>`;
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function updateCounter(shown, total) {
  const sel = data.getSelectedCount();
  let t = filterSelectedOnly ? `Showing ${sel} Selected` : `${sel} / ${total} Selected`;
  if (!filterSelectedOnly && shown !== total) t += ` (${shown} matching)`;
  $("#selection-counter").textContent = t;
}

// ═══════════════════ FRIEND ACTIONS ═══════════════════
async function toggleFriend(i) {
  const friends = data.getFriends();
  if (i >= 0 && i < friends.length) {
    friends[i].selected = !friends[i].selected;
    await data.saveProfiles();
    renderFriends();
  }
}

async function bulkSelect(val) {
  const friends = data.getFriends();
  friends.forEach(f => {
    if (!searchQuery || f.username.toLowerCase().includes(searchQuery) || (f.name || "").toLowerCase().includes(searchQuery))
      f.selected = val;
  });
  await data.saveProfiles();
  renderFriends();
}

async function addFriend() {
  if (!data.currentProfile) { toast("Create a profile first", "error"); return; }
  const username = $("#input-friend-username").value.trim();
  const name = $("#input-friend-name").value.trim();
  if (!username) return;
  if (!data.addFriend(username, name)) { toast("Friend already exists", "error"); return; }
  await data.saveProfiles();
  $("#input-friend-username").value = "";
  $("#input-friend-name").value = "";
  renderFriends();
  toast("Friend added!", "success");
}

// ═══════════════════ EDIT FRIEND MODAL ═══════════════════
function openEditFriend(i) {
  const friends = data.getFriends();
  const f = friends[i];
  if (!f) return;
  showModal(`
    <div class="modal-title">Edit Contact Details</div>
    <div class="modal-field"><label class="modal-label">Contact Name</label><input class="modal-input" id="m-fname" value="${esc(f.name || "")}"></div>
    <div class="modal-field"><label class="modal-label">Snapchat Username</label><input class="modal-input" id="m-funame" value="${esc(f.username)}"></div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="m-fsave">Update Friend</button>
      <button class="modal-btn danger" id="m-fdel">Delete</button>
    </div>
  `);
  $("#m-fsave").addEventListener("click", async () => {
    const uname = $("#m-funame").value.trim();
    if (!uname) { toast("Username required", "error"); return; }
    if (friends.some((x, j) => j !== i && x.username.toLowerCase() === uname.toLowerCase())) { toast("Username already exists", "error"); return; }
    friends[i].username = uname;
    friends[i].name = $("#m-fname").value.trim();
    await data.saveProfiles();
    closeModal(); renderFriends(); toast("Friend updated!", "success");
  });
  $("#m-fdel").addEventListener("click", async () => {
    if (!confirm("Delete this friend?")) return;
    friends.splice(i, 1);
    await data.saveProfiles();
    closeModal(); renderFriends(); toast("Friend deleted", "success");
  });
}

// ═══════════════════ PROFILE MENU ═══════════════════
function openProfileMenu() {
  const names = Object.keys(data.profiles);
  const rows = names.map(n => {
    const active = n === data.currentProfile;
    const bg = active ? "var(--profile-active)" : "var(--profile-inactive)";
    return `<div class="profile-item">
      <input type="checkbox" class="profile-checkbox" data-pcheck="${esc(n)}">
      <button class="profile-name-btn" style="background:${bg}" data-pswitch="${esc(n)}">${esc(n)}</button>
      <button class="profile-edit-btn" data-pedit="${esc(n)}">✎ Edit</button>
    </div>`;
  }).join("");

  showModal(`
    <div class="modal-title">Accounts</div>
    <div id="profile-list-area">${rows || '<p style="text-align:center;color:var(--text-muted)">No accounts yet</p>'}</div>
    <div class="modal-separator"></div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="m-padd">+ Add New Account</button>
      <button class="modal-btn secondary" id="m-pexport" style="flex:0.5">⭳ Export</button>
      <button class="modal-btn secondary" id="m-pimport" style="flex:0.5">⭱ Import</button>
    </div>
  `);

  document.querySelectorAll("[data-pswitch]").forEach(el => {
    el.addEventListener("click", async () => {
      data.currentProfile = el.dataset.pswitch;
      await data.saveProfiles();
      closeModal(); refreshUI();
    });
  });
  document.querySelectorAll("[data-pedit]").forEach(el => {
    el.addEventListener("click", () => { closeModal(); openProfileDetails(el.dataset.pedit, false); });
  });
  $("#m-padd").addEventListener("click", () => { closeModal(); openProfileDetails(null, true); });
  $("#m-pexport").addEventListener("click", () => exportProfiles());
  $("#m-pimport").addEventListener("click", () => { closeModal(); importProfiles(); });
}

// ═══════════════════ PROFILE DETAILS ═══════════════════
function openProfileDetails(name, isNew) {
  const s = isNew ? {} : (data.profiles[name]?.settings || {});
  showModal(`
    <div class="modal-title">${isNew ? "New Account" : `Edit '${esc(name)}'`}</div>
    ${isNew ? `<div class="modal-field"><label class="modal-label">Account Name</label><input class="modal-input" id="m-pname" placeholder="e.g. My Main"></div>` : ""}
    <div class="modal-field"><label class="modal-label">Snapchat Username</label><input class="modal-input" id="m-suser" value="${esc(s.username || "")}"></div>
    <div class="modal-field"><label class="modal-label">Account Email</label><input class="modal-input" id="m-semail" value="${esc(s.email || "")}"></div>
    <div class="modal-field"><label class="modal-label">Mobile Number</label><input class="modal-input" id="m-sphone" value="${esc(s.mobile_number || "")}"></div>
    <div class="modal-field"><label class="modal-label">Device</label><input class="modal-input" id="m-sdevice" value="${esc(s.device || "")}" placeholder="e.g. iPhone 14"></div>
    <div class="modal-field"><label class="modal-label">Refresh Delay (seconds)</label><input class="modal-input" id="m-sdelay" type="number" step="0.5" min="0" value="${s.refresh_delay ?? 1.0}"></div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="m-psave">${isNew ? "Create Account" : "Save Details"}</button>
      ${!isNew ? `<button class="modal-btn danger" id="m-pdel">Delete</button>` : ""}
    </div>
  `);

  $("#m-psave").addEventListener("click", async () => {
    const newSettings = {
      username: $("#m-suser").value.trim(),
      email: $("#m-semail").value.trim(),
      mobile_number: $("#m-sphone").value.trim(),
      device: $("#m-sdevice").value.trim(),
      refresh_delay: parseFloat($("#m-sdelay").value) || 1.0,
    };
    if (isNew) {
      const pname = $("#m-pname").value.trim();
      if (!pname) { toast("Account name required", "error"); return; }
      if (!data.addProfile(pname, newSettings)) { toast("Name already exists", "error"); return; }
      data.currentProfile = pname;
    } else {
      data.profiles[name].settings = newSettings;
    }
    await data.saveProfiles();
    closeModal(); refreshUI(); toast(isNew ? "Account created!" : "Details saved!", "success");
  });

  if (!isNew) {
    const del = $("#m-pdel");
    if (del) del.addEventListener("click", async () => {
      if (!confirm("Delete this profile?")) return;
      data.deleteProfile(name);
      await data.saveProfiles();
      closeModal(); refreshUI(); toast("Profile deleted", "success");
    });
  }
}

// ═══════════════════ SETTINGS MODAL ═══════════════════
function openSettingsModal() {
  const s = data.appSettings;
  showModal(`
    <div class="modal-title">Global Settings</div>
    <div class="modal-field"><label class="modal-label">Appearance Mode</label>
      <select class="modal-select" id="m-appearance"><option ${s.appearance_mode === "System" ? "selected" : ""}>System</option><option ${s.appearance_mode === "Light" ? "selected" : ""}>Light</option><option ${s.appearance_mode === "Dark" ? "selected" : ""}>Dark</option></select>
    </div>
    <div class="modal-field"><label class="modal-label">Friends List Style</label>
      <select class="modal-select" id="m-viewmode"><option ${s.view_mode === "Grid" ? "selected" : ""}>Grid</option><option ${s.view_mode === "List" ? "selected" : ""}>List</option></select>
    </div>
    <div class="modal-field"><label class="modal-label">Overlay Position</label>
      <select class="modal-select" id="m-overlay-pos">
        <option ${s.overlay_position === "Top" ? "selected" : ""}>Top</option>
        <option ${s.overlay_position === "Bottom" ? "selected" : ""}>Bottom</option>
      </select>
    </div>
    <div class="modal-separator"></div>
    <button class="modal-btn secondary" id="m-update" style="width:100%;margin-bottom:8px">🔄 Check for Updates</button>
    <button class="modal-btn secondary" id="m-help" style="width:100%;margin-bottom:8px">❓ How to Use (Help)</button>
    <button class="modal-btn secondary" id="m-about" style="width:100%;margin-bottom:16px">👨‍💻 About Developer</button>
    <div class="modal-actions"><button class="modal-btn primary" id="m-ssave">Save Settings</button></div>
  `);

  $("#m-ssave").addEventListener("click", async () => {
    data.appSettings.appearance_mode = $("#m-appearance").value;
    data.appSettings.view_mode = $("#m-viewmode").value;
    data.appSettings.overlay_position = $("#m-overlay-pos").value;
    await data.saveAppSettings();
    applyTheme();
    closeModal(); renderFriends(); toast("Settings saved!", "success");
  });
  $("#m-update").addEventListener("click", () => { closeModal(); openUpdateCheck(); });
  $("#m-help").addEventListener("click", () => { closeModal(); openHelp(); });
  $("#m-about").addEventListener("click", () => { closeModal(); openAbout(); });
}

function openHelp() {
  showModal(`
    <div class="modal-title">Help & Instructions</div>
    <div class="help-text">1. Create a Profile:
   Click the profile avatar icon and '+ Add New Account'.

2. Fill Details:
   Enter your Snapchat Username, Email, Phone, Device.

3. Add Friends:
   Use the bottom section to add friends by username.

4. Selection:
   Click the checkbox next to friends you want to recover.

5. Run Recovery:
   Click '🚀 RECOVER SELECTED STREAKS'.

6. Browser Automation:
   A new tab opens with the Snapchat support form pre-filled.
   Solve the Captcha if prompted and click Submit.
   The extension auto-advances to the next friend.

7. Done:
   The status bar shows completion when all friends are processed.</div>
    <div class="modal-actions"><button class="modal-btn secondary" data-close-modal>Close</button></div>
  `);
}

function openAbout() {
  showModal(`
    <div class="about-center">
      <div class="modal-title">${APP_NAME}</div>
      <div class="version">Version ${VERSION}</div>
      <div class="about-body">This extension automates repetitive Snapchat support requests safely and efficiently.

Developed by: ${DEVELOPER}

For updates and support, visit our GitHub.</div>
      <a href="${GITHUB_URL}" target="_blank" class="github-btn">Visit GitHub</a>
    </div>
    <div class="modal-actions" style="margin-top:16px"><button class="modal-btn secondary" data-close-modal>Close</button></div>
  `);
}

function openUpdateCheck() {
  showModal(`
    <div class="about-center">
      <div class="modal-title">🔄 Check for Updates</div>
      <div id="update-status" style="padding: 20px 0; color: var(--text-muted); text-align: center;">
        <div class="sr-spinner-modal"></div>
        <p style="margin-top: 12px;">Checking GitHub for latest version...</p>
      </div>
    </div>
    <div class="modal-actions"><button class="modal-btn secondary" data-close-modal>Close</button></div>
  `);

  const RELEASES_URL = "https://api.github.com/repos/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension/releases/latest";

  fetch(RELEASES_URL)
    .then(r => r.json())
    .then(release => {
      const latest = (release.tag_name || "").replace(/^v/i, "");
      const current = VERSION;
      const statusEl = document.getElementById("update-status");
      if (!statusEl) return;

      if (!latest) {
        statusEl.innerHTML = `<p style="color: var(--danger)">❌ Could not fetch version info.</p>`;
        return;
      }

      if (latest === current) {
        statusEl.innerHTML = `
          <div style="font-size: 32px">✅</div>
          <p style="color: var(--accent); font-weight: 700; margin-top: 8px;">You're up to date!</p>
          <p style="font-size: 12px; color: var(--text-muted);">Current version: v${current}</p>
        `;
      } else {
        statusEl.innerHTML = `
          <div style="font-size: 32px">🎉</div>
          <p style="color: #FFFC00; font-weight: 700; margin-top: 8px;">New version available!</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Your version: v${current} &rarr; Latest: v${latest}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">${esc(release.name || "")}</p>
          <a href="${GITHUB_URL}/releases/latest" target="_blank" class="github-btn" style="font-size: 13px;">🔗 Download Update from GitHub</a>
        `;
      }
    })
    .catch(() => {
      const statusEl = document.getElementById("update-status");
      if (statusEl) statusEl.innerHTML = `<p style="color: var(--danger)">❌ Network error. Please check your connection.</p>`;
    });
}

// ═══════════════════ IMPORT / EXPORT ═══════════════════
function exportProfiles() {
  const checks = document.querySelectorAll("[data-pcheck]");
  const selected = [];
  checks.forEach(c => { if (c.checked) selected.push(c.dataset.pcheck); });
  if (!selected.length) { toast("Select profiles to export", "error"); return; }
  const exportData = {};
  selected.forEach(n => { if (data.profiles[n]) exportData[n] = data.profiles[n]; });
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = (selected.length > 1 ? "multiple_profiles" : selected[0]) + "_export.json";
  a.click(); URL.revokeObjectURL(url);
  toast("Exported!", "success");
}

function importProfiles() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json";
  input.addEventListener("change", async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (typeof imported !== "object" || !Object.keys(imported).length) { toast("Invalid format", "error"); return; }
      let count = 0;
      for (const [origName, pdata] of Object.entries(imported)) {
        if (!pdata.settings || !pdata.friends) continue;
        let name = origName, c = 1;
        while (data.profiles[name]) { name = c > 1 ? `${origName} (Imported ${c})` : `${origName} (Imported)`; c++; }
        data.profiles[name] = pdata; count++;
      }
      if (count) { await data.saveProfiles(); refreshUI(); toast(`Imported ${count} account(s)!`, "success"); }
      else toast("No valid profiles found", "error");
    } catch { toast("Import failed", "error"); }
  });
  input.click();
}

// ═══════════════════ RECOVERY ═══════════════════
async function startRecovery() {
  const selected = data.getSelectedFriends();
  if (!selected.length) { toast("No friends selected", "error"); return; }
  const settings = data.getSettings();
  if (!settings.username || !settings.email) { toast("Complete profile details first", "error"); return; }

  const btn = $("#btn-recover");
  btn.disabled = true; btn.textContent = "⏳ Running..."; btn.classList.add("running");
  sessionFailures = []; // Reset for new run
  setStatus("processing", 0, selected.length, selected[0]);

  try {
    await chrome.runtime.sendMessage({
      action: "startRecovery",
      settings, friends: selected,
      delay: settings.refresh_delay || 1.0,
      overlay_position: data.appSettings.overlay_position || "Top"
    });
  } catch (e) {
    setStatus("error", 0, 0, e.message);
    btn.disabled = false; btn.textContent = "🚀 RECOVER SELECTED STREAKS"; btn.classList.remove("running");
  }
}

// Listen for progress from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "recoveryProgress") {
    setStatus("processing", msg.current, msg.total, msg.friend);
  } else if (msg.action === "friendFailed") {
    sessionFailures.push({ friend: msg.friend, error: msg.error });
    setStatus("friendFailed", sessionFailures.length);
  } else if (msg.action === "recoveryComplete") {
    if (msg.failures) sessionFailures = msg.failures;
    setStatus("done");
    const btn = $("#btn-recover");
    btn.disabled = false; btn.textContent = "🚀 RECOVER SELECTED STREAKS"; btn.classList.remove("running");
    if (sessionFailures.length > 0) {
      toast(`${sessionFailures.length} issues during recovery`, "error");
    } else {
      toast("All friends processed!", "success");
    }
  } else if (msg.action === "recoveryError") {
    setStatus("error", 0, 0, msg.error);
    const btn = $("#btn-recover");
    btn.disabled = false; btn.textContent = "🚀 RECOVER SELECTED STREAKS"; btn.classList.remove("running");
  }
});

// ═══════════════════ STATUS BAR ═══════════════════
function setStatus(type, current, total, detail) {
  const text = $("#status-text");
  const bar = $("#progress-bar-container");
  const fill = $("#progress-bar");
  const statusBar = $("#status-bar");

  // Remove previous error states
  statusBar.classList.remove("has-errors", "shaking");

  if (type === "processing") {
    const trunc = detail && detail.length > 18 ? detail.slice(0, 15) + "..." : detail;
    text.innerHTML = `⏳ [${current + 1}/${total}] Processing: ${trunc}`;
    bar.classList.remove("hidden");
    fill.style.width = `${((current + 1) / total) * 100}%`;
  } else if (type === "friendFailed") {
    // Briefly shake on new failure
    statusBar.classList.add("shaking");
    setTimeout(() => statusBar.classList.remove("shaking"), 500);
  } else if (type === "done") {
    if (sessionFailures.length > 0) {
      statusBar.classList.add("has-errors");
      text.innerHTML = `🎉 Done (with <span class="error-link" id="view-errors">${sessionFailures.length} errors</span>)`;
      $("#view-errors").addEventListener("click", showErrorLog);
    } else {
      text.textContent = "🎉 All friends processed!";
    }
    fill.style.width = "100%";
  } else if (type === "error") {
    const msg = detail && detail.length > 40 ? detail.slice(0, 37) + "..." : detail;
    text.textContent = `❌ ${msg || "Error"}`;
    bar.classList.add("hidden");
  } else {
    text.textContent = "✅ Ready";
    bar.classList.add("hidden");
  }

  // Always show error count if during process
  if (type === "processing" && sessionFailures.length > 0) {
    statusBar.classList.add("has-errors");
    text.innerHTML += ` <span class="error-badge" id="view-errors-mini">⚠️ ${sessionFailures.length}</span>`;
    const mini = $("#view-errors-mini");
    if (mini) mini.addEventListener("click", showErrorLog);
  }
}

function showErrorLog() {
  const list = sessionFailures.map(f => `
    <div class="error-log-item">
      <div class="error-log-friend">Friend: <strong>${esc(f.friend)}</strong></div>
      <div class="error-log-msg">${esc(f.error)}</div>
    </div>
  `).join("");

  showModal(`
    <div class="modal-title">Recovery Error Log</div>
    <div class="error-log-container">${list || "<p>No errors recorded</p>"}</div>
    <div class="modal-actions">
      <button class="modal-btn secondary" data-close-modal>Close</button>
    </div>
  `);
}

// ═══════════════════ MODAL SYSTEM ═══════════════════
function showModal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal-overlay").classList.remove("hidden");
  // Wire overlay background click
  $("#modal-overlay").addEventListener("click", e => { if (e.target === $("#modal-overlay")) closeModal(); });
  // Wire all [data-close-modal] buttons — safe alternative to onclick= (CSP compliant)
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });
}

function closeModal() { $("#modal-overlay").classList.add("hidden"); }

// ═══════════════════ TOAST ═══════════════════
function toast(msg, type = "success") {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.className = `toast ${type}`;
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => el.classList.remove("show"), 2500);
}
