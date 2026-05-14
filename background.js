/* Background Service Worker — orchestrates recovery across tabs */

const FORM_URL = "https://help.snapchat.com/hc/en-us/requests/new?co=true&ticket_form_id=149423";
const NOTIF_ID = "streak-recovery-notif";
let recoveryState = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startRecovery") {
    startRecovery(msg.settings, msg.friends, msg.delay, msg.overlay_position);
    sendResponse({ ok: true });
  } else if (msg.action === "formFilled") {
    handleFormFilled();
  } else if (msg.action === "formSubmitted") {
    handleFormSubmitted();
  }
  return true;
});

async function startRecovery(settings, friends, delay, overlay_position) {
  recoveryState = { settings, friends, delay, current: 0, tabId: null, failures: [], overlay_position: overlay_position || "Top" };
  await processNext();
}

async function processNext() {
  if (!recoveryState) return;
  const { friends, current, settings, delay } = recoveryState;

  if (current >= friends.length) {
    updateNotification(current, friends.length, "", true);
    broadcast({ action: "recoveryComplete", failures: recoveryState.failures });
    recoveryState = null;
    return;
  }

  const friend = friends[current];
  updateNotification(current, friends.length, friend);
  broadcast({ action: "recoveryProgress", current, total: friends.length, friend });

  try {
    if (!recoveryState.tabId) {
      const tab = await chrome.tabs.create({ url: FORM_URL, active: true });
      recoveryState.tabId = tab.id;
    } else {
      await chrome.tabs.update(recoveryState.tabId, { url: FORM_URL });
    }

    // Wait for page load, then inject fill data
    await waitForTabLoad(recoveryState.tabId);
    await new Promise(r => setTimeout(r, 1500));

    await chrome.tabs.sendMessage(recoveryState.tabId, {
      action: "fillForm",
      settings,
      friendUsername: friend,
      current: current + 1,
      total: friends.length,
      overlay_position: recoveryState.overlay_position,
      autoSubmit: true
    });
  } catch (e) {
    console.error("[BG] Error processing:", friend, e);
    const errorMsg = e.message || "Unknown error";
    recoveryState.failures.push({ friend, error: errorMsg });
    broadcast({ action: "friendFailed", friend, error: errorMsg });
    
    // Try to continue with next friend
    recoveryState.current++;
    setTimeout(() => processNext(), 1000);
  }
}

function handleFormFilled() {
  // Form was filled, now waiting for submission detection
  console.log("[BG] Form filled, waiting for submit...");
}

function handleFormSubmitted() {
  if (!recoveryState) return;
  const delay = (recoveryState.delay || 1) * 1000;
  recoveryState.current++;
  setTimeout(() => processNext(), delay);
}

// Monitor tab URL changes to detect form submission
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!recoveryState || tabId !== recoveryState.tabId) return;
  if (changeInfo.url && !changeInfo.url.includes("/requests/new")) {
    // URL changed away from the form — submission detected
    handleFormSubmitted();
  }
});

// Monitor tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  if (recoveryState && tabId === recoveryState.tabId) {
    broadcast({ action: "recoveryError", error: "Browser tab closed by user" });
    recoveryState = null;
  }
});

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { reject(new Error("Tab load timeout")); }, 30000);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

function updateNotification(current, total, friend, isComplete = false) {
  const options = {
    type: isComplete ? "basic" : "progress",
    iconUrl: "icons/icon128.png",
    title: isComplete ? "Recovery Complete! 🎉" : "Recovering Streaks...",
    message: isComplete 
      ? `All ${total} friends have been processed.` 
      : `Next: ${friend} (${current + 1} of ${total})`,
    priority: 1
  };
  
  if (!isComplete) {
    options.progress = Math.round((current / total) * 100);
  }

  chrome.notifications.create(NOTIF_ID, options);
}
