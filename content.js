/* Content Script — injected into Snapchat support form pages */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillForm") {
    fillForm(msg.settings, msg.friendUsername, msg.autoSubmit, msg.current, msg.total, msg.overlay_position);
    sendResponse({ ok: true });
  }
  return true;
});

async function fillForm(settings, friendUsername, autoSubmit, current, total, position) {
  console.log("[CS] Filling form for:", friendUsername);
  updateOverlay(`Recovering: ${friendUsername} (${current} of ${total})`, position);

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
        const prototype = el.tagName === "TEXTAREA" 
          ? window.HTMLTextAreaElement.prototype 
          : window.HTMLInputElement.prototype;
        
        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

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

function createOverlay(position = "Top") {
  let el = document.getElementById("sr-overlay");
  const isBottom = position === "Bottom";
  
  if (!el) {
    el = document.createElement("div");
    el.id = "sr-overlay";
    el.style.cssText = `
      position: fixed; ${isBottom ? "bottom: 15px;" : "top: 15px;"} left: 50%; transform: translateX(-50%);
      background: rgba(26, 26, 26, 0.9); backdrop-filter: blur(12px);
      color: #fff; padding: 10px 20px; border-radius: 50px;
      z-index: 99999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; gap: 12px; pointer-events: none;
      transition: all 0.3s ease;
    `;
    
    const style = document.createElement("style");
    style.textContent = `
      #sr-overlay { animation: ${isBottom ? "sr-slideUp" : "sr-slideDown"} 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
      @keyframes sr-slideDown { from { transform: translate(-50%, -60px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      @keyframes sr-slideUp { from { transform: translate(-50%, 60px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      .sr-spinner { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,0.2); border-top-color: #FFFC00; border-radius: 50%; animation: sr-spin 0.8s linear infinite; }
      @keyframes sr-spin { to { transform: rotate(360deg); } }
      .sr-badge { background: #FFFC00; color: #000; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-right: 4px; }
    `;
    document.head.appendChild(style);
    
    el.innerHTML = `<span class="sr-badge">Streak Recovery</span><div class="sr-spinner"></div><div id="sr-content" style="font-size: 13px; font-weight: 600;"></div>`;
    document.body.appendChild(el);
  } else {
    // Update position if it changed
    el.style.top = isBottom ? "auto" : "15px";
    el.style.bottom = isBottom ? "15px" : "auto";
  }
  return el;
}

function updateOverlay(text, position) {
  const el = createOverlay(position);
  document.getElementById("sr-content").textContent = text;
}
