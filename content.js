/* Content Script — injected into Snapchat support form pages */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillForm") {
    fillForm(msg.settings, msg.friendUsername, msg.autoSubmit);
    sendResponse({ ok: true });
  }
  return true;
});

async function fillForm(settings, friendUsername, autoSubmit) {
  console.log("[CS] Filling form for:", friendUsername);

  // Wait for form to be ready
  await waitForSelector("#request_custom_fields_24281229", 15000);

  const fields = [
    ["#request_custom_fields_24281229", settings.username || ""],
    ["#request_custom_fields_24335325", settings.email || ""],
    ["#request_custom_fields_24369716", settings.mobile_number || ""],
    ["#request_custom_fields_24335345", settings.device || ""],
    ["#request_custom_fields_24369736", friendUsername],
    ["#request_custom_fields_24369756", new Date().toISOString().split("T")[0]],
    ["#request_description", "My snapstreak disappeared recently without any reason. Please restore it."],
  ];

  for (const [selector, value] of fields) {
    try {
      const el = document.querySelector(selector);
      if (el && value) {
        // Use native input setter to trigger React/Angular change events
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value"
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(el, value);
        } else {
          el.value = value;
        }

        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        await sleep(400);
      }
    } catch (e) {
      console.warn("[CS] Field fill error:", selector, e);
    }
  }

  chrome.runtime.sendMessage({ action: "formFilled" });

  // Auto-submit
  if (autoSubmit) {
    await sleep(800);
    const submitSelectors = ['input[type="submit"]', 'button[type="submit"]', 'input[name="commit"]'];
    for (const sel of submitSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        console.log("[CS] Clicking submit:", sel);
        btn.click();
        break;
      }
    }
  }
}

function waitForSelector(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); clearTimeout(timer); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      // Resolve anyway — form might have different structure
      resolve(null);
    }, timeout);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
