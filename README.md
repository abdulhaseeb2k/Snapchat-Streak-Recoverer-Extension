# 🔥 Snapchat Streak Recoverer — Chrome Extension

A premium Chrome extension that automates Snapchat streak recovery by bulk-submitting support forms. Manage multiple accounts, organize friends, and recover lost streaks with a single click.

> **Sister project:** [Desktop App (Python)](https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer) — same features as a standalone Windows application.

---

## ✨ Features

- **Multi-Account Profiles** — Create and switch between multiple Snapchat accounts
- **Friend Management** — Add, edit, delete, and search friends with grid/list views
- **Bulk Recovery** — Select friends and auto-submit support forms for all of them
- **Auto Form Fill** — Automatically fills every field on the Snapchat support page
- **Import / Export** — Backup and restore profiles as JSON files
- **Dark & Light Themes** — Premium UI with system theme detection
- **Zero Dependencies** — Pure HTML/CSS/JS, no frameworks needed

---

## 📦 Installation

### From Source (Developer Mode)

1. **Download** this repository (Code → Download ZIP) or clone it:
   ```bash
   git clone https://github.com/abdulhaseeb2k/Snapchat-Streak-Recoverer-Extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked**

5. Select the cloned/extracted folder

6. The extension icon appears in your toolbar — click it to open!

---

## 🚀 How to Use

1. **Create an Account** — Click the profile avatar → `+ Add New Account`
2. **Fill Details** — Enter your Snapchat username, email, phone, and device
3. **Add Friends** — Type a friend's username in the bottom bar and click `+ Add Friend`
4. **Select Friends** — Check the friends you want to recover streaks for
5. **Recover** — Click `🚀 RECOVER SELECTED STREAKS`
6. **Auto-Fill** — The extension opens a tab and fills the Snapchat support form
7. **Submit** — Solve the captcha (if shown) and the form auto-submits
8. **Repeat** — The extension automatically processes the next friend

---

## 🗂️ Project Structure

```
├── manifest.json        # Chrome Extension Manifest V3
├── popup.html           # Main popup UI
├── popup.css            # Premium dark/light theme styles
├── popup.js             # UI logic, data management, modals
├── background.js        # Service worker for tab orchestration
├── content.js           # Content script for form auto-fill
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🛡️ Permissions

| Permission | Why |
|---|---|
| `storage` | Save profiles and friends locally |
| `tabs` | Open and manage the Snapchat support tab |
| `activeTab` | Interact with the current tab |
| `scripting` | Inject form-filling script |
| `help.snapchat.com` | Auto-fill the support form |

---

## 👨‍💻 Developer

**Abdul Haseeb**
- GitHub: [@abdulhaseeb2k](https://github.com/abdulhaseeb2k)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
