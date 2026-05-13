/* Background Service Worker — orchestrates recovery across tabs */

const FORM_URL = "https://help.snapchat.com/hc/en-us/requests/new?co=true&ticket_form_id=149423";
let recoveryState = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startRecovery") {
    startRecovery(msg.settings, msg.friends, msg.delay);
    sendResponse({ ok: true });
  } else if (msg.action === "formFilled") {
    handleFormFilled();
  } else if (msg.action === "formSubmitted") {
    handleFormSubmitted();
  }
  return true;
});

async function startRecovery(settings, friends, delay) {
  recoveryState = { settings, friends, delay, current: 0, tabId: null };
  await processNext();
}

async function processNext() {
  if (!recoveryState) return;
  const { friends, current, settings, delay } = recoveryState;

  if (current >= friends.length) {
    broadcast({ action: "recoveryComplete" });
    recoveryState = null;
    return;
  }

  const friend = friends[current];
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
      autoSubmit: true
    });
  } catch (e) {
    console.error("[BG] Error processing:", friend, e);
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
