<div align="center">

<img src="icons/icon128.png" alt="Snapchat Streak Recoverer Logo" width="100"/>

# 🔥 Snapchat Streak Recoverer

**Automate your Snapchat streak recovery requests — fast, bulk, and effortless.**

[![Version](https://img.shields.io/badge/version-1.01-yellow?style=for-the-badge&logo=snapchat)](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Manifest](https://img.shields.io/badge/manifest-v3-blue?style=for-the-badge&logo=googlechrome)](manifest.json)
[![Open Source](https://img.shields.io/badge/open%20source-%E2%9D%A4-red?style=for-the-badge)](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension)

> A premium Chrome Extension that automatically fills and submits the Snapchat support form to recover lost streaks — for multiple friends at once.

</div>

---

## ✨ Features

### 👤 Multi-Profile Management
- Create **multiple accounts** (profiles) — one for each Snapchat account you manage
- Store your Snapchat username, email, mobile number, and device per profile
- Switch between profiles instantly
- **Export & Import** profiles as JSON for backup or sharing

### 👥 Friend List Management
- Add friends by **Snapchat username** and optional display name
- **Search** friends in real-time by name or username
- **Grid & List view** — choose whichever layout you prefer
- **Custom checkbox UI** — select or deselect friends with a premium animated checkbox
- Bulk **Select All / Deselect All** with one click
- Click the **selection counter** to instantly filter and view only selected friends

### 🚀 Bulk Streak Recovery
- Recover streaks for **multiple friends in one click**
- Automatically opens and fills the [Snapchat Support Form](https://help.snapchat.com/hc/en-us/requests/new?co=true&ticket_form_id=149423) for each friend
- Configurable **delay between submissions** (in seconds)
- Continues to the next friend automatically after each form submission

### 📊 Real-Time Progress Tracking
- **In-popup status bar** shows current friend being processed and progress count
- **In-page floating overlay** on the Snapchat form — shows who is being processed right on the form page
- **Customizable overlay position** — choose Top or Bottom via Settings
- **Native browser notifications** with a live progress bar, visible even when the extension popup is closed

### ⚠️ Smart Error Reporting
- If a friend's recovery fails, the extension **skips and continues** instead of stopping
- **Shake animation** in the status bar alerts you to a new failure instantly
- At the end, a clickable **error count badge** shows how many failed
- Click to open a **detailed Error Log modal** showing exactly which friend failed and why (e.g., "Tab load timeout")

### 🎨 Premium UI / UX
- **Dark mode** by default with Light and System options
- Glassmorphism, smooth animations, and micro-interactions throughout
- Custom animated **checkbox system** (no text indicators)
- **Toast notifications** for all actions (add, delete, save, etc.)
- Modern, responsive design built with pure CSS — no frameworks

### 🔄 Update Checker
- Built-in **"Check for Updates"** button in Settings
- Fetches the latest release directly from GitHub
- Shows current vs latest version and a direct download link if an update is available

---

## 📦 Installation (Manual — Chrome Developer Mode)

Since this extension is **not on the Chrome Web Store**, you install it manually. It takes less than a minute!

### Step 1 — Download the Extension

**Option A: Clone with Git**
```bash
git clone https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension.git
```

**Option B: Download ZIP**
1. Go to the [GitHub Repository](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension)
2. Click the green **`Code`** button → **`Download ZIP`**
3. Extract the ZIP to a folder on your computer

### Step 2 — Open Chrome Extensions Page
Open Google Chrome and go to:
```
chrome://extensions
```
Or: Click the **⋮ menu** → **Extensions** → **Manage Extensions**

### Step 3 — Enable Developer Mode
In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.

![Developer Mode Toggle](https://i.imgur.com/W5FLHX7.png)

### Step 4 — Load the Extension
1. Click the **"Load unpacked"** button (top-left)
2. Browse to and select the folder you downloaded/cloned (the one containing `manifest.json`)
3. Click **Select Folder**

### Step 5 — Pin to Toolbar *(Optional but Recommended)*
1. Click the **puzzle piece 🧩 icon** in the Chrome toolbar
2. Find **Snapchat Streak Recoverer**
3. Click the **📌 pin icon** to pin it to your toolbar

✅ **Done!** Click the extension icon to open it.

---

## 🛠️ How to Use

```
1. Create a Profile
   Click the avatar button (top-left) → "+ Add New Account"
   Fill in your Snapchat username, email, phone, and device.

2. Add Friends
   In the "Add a Friend" section at the bottom, enter
   the Snapchat username of the friend whose streak you want to recover.

3. Select Friends
   Click the checkbox next to each friend you want to recover.
   Use "Select All" to quickly pick everyone.

4. Start Recovery
   Click "🚀 RECOVER SELECTED STREAKS"
   A new tab will open with the Snapchat support form pre-filled.

5. Solve Captcha (if prompted)
   The extension handles everything else — you only need to
   solve the Captcha when it appears.

6. Watch Progress
   The floating overlay on the form page shows who is being
   processed. The status bar in the popup tracks overall progress.

7. Review Errors (if any)
   After completion, click the error badge to see
   which friends failed and why.
```

---

## ⚙️ Settings

| Setting | Options | Description |
|---|---|---|
| Appearance Mode | Dark / Light / System | Extension UI theme |
| Friends List Style | Grid / List | How friends are displayed |
| Overlay Position | Top / Bottom | Position of the in-page progress bar on the Snapchat form |
| Check for Updates | — | Checks GitHub for a newer version |

---

## 📁 Project Structure

```
Snapchat-Streak-Recoverer-Extension/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html          # Main extension UI layout
├── popup.js            # All UI logic, state management, recovery flow
├── popup.css           # Premium dark-mode design system
├── background.js       # Service worker — orchestrates form automation
├── content.js          # Injected into Snapchat form — fills fields & shows overlay
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # This file
```

---

## 🔒 Permissions Explained

| Permission | Why It's Needed |
|---|---|
| `storage` | Save profiles and settings locally on your device |
| `tabs` | Open and manage the Snapchat support form tab |
| `activeTab` | Interact with the currently active tab |
| `scripting` | Inject the form-filling content script |
| `notifications` | Show real-time progress notifications |
| `https://help.snapchat.com/*` | Access the Snapchat support form page |
| `https://api.github.com/*` | Check for extension updates from GitHub |

> ⚠️ **No data is sent to any external server.** All profile data is stored locally using `chrome.storage.local`.

---

## 🤝 Contributing

This is an open source project! Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

---

## 📜 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ by **[Abdul Haseeb](https://github.com/abdulhaseeb2k)**

⭐ **Star this repo** if it helped you recover your streaks!

[Report a Bug](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension/issues) · [Request a Feature](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension/issues) · [Latest Release](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension/releases)

</div>
