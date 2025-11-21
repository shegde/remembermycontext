// ============================================
// ENVIRONMENT SWITCH - Must match config.js
// ============================================
const USE_LOCAL = false;  // Set to true for localhost, false for production
// ============================================

const PRODUCTION_API = 'https://remembermycontexttest.onrender.com/api/v1';
const LOCAL_API = 'http://localhost:8000/api/v1';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.storage.local.get(['remembermycontext_config'], (result) => {
      const config = result.remembermycontext_config;
      const API_BASE = config?.apiBaseUrl || (USE_LOCAL ? LOCAL_API : PRODUCTION_API);
      
      fetch(`${API_BASE}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: 'extension_installed',
          metadata: {
            reason: details.reason,
            version: chrome.runtime.getManifest().version,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(() => {});
    });
  }
  
  if (chrome.sidePanel) {
    chrome.sidePanel.setOptions({ path: 'popup/index.html' });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      chrome.action.setPopup({ popup: 'popup/index.html' });
    }
  } catch (error) {
    chrome.action.setPopup({ popup: 'popup/index.html' });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      chrome.runtime.sendMessage({
        action: "tabChanged",
        tabId: activeInfo.tabId,
        url: tab.url
      }).catch(() => {});
    }
  } catch (error) {
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    chrome.runtime.sendMessage({
      action: "tabChanged",
      tabId: tabId,
      url: changeInfo.url
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertText") {
    (async () => {
      try {
        let activeTab = null;
        let retries = 10;
        
        while (retries > 0 && !activeTab) {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          
          if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            if (tab.url && 
                tab.url !== 'chrome://newtab/' && 
                !tab.url.startsWith('chrome://') && 
                !tab.url.startsWith('chrome-extension://') &&
                !tab.url.startsWith('edge://')) {
              activeTab = tab;
              break;
            }
          }
          
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (!activeTab) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }
        
        try {
          const url = new URL(activeTab.url);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            sendResponse({ success: false, error: "Cannot insert into Chrome pages" });
            return;
          }
        } catch (e) {
          sendResponse({ success: false, error: "Invalid URL" });
          return;
        }
        
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: insertTextIntoActiveElement,
            args: [request.text]
          });
          
          if (results && results[0] && results[0].result === true) {
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "insert_failed" });
          }
        } catch (error) {
          sendResponse({ success: false, error: "insert_error" });
        }
      } catch (error) {
        sendResponse({ success: false, error: "general_error" });
      }
    })();
    
    return true;
  }
});

function insertTextIntoActiveElement(text) {
  let inserted = false;
  const activeElement = document.activeElement;
  
  function tryInsert(element) {
    if (!element) return false;
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      try {
        const start = element.selectionStart !== null ? element.selectionStart : element.value.length;
        const end = element.selectionEnd !== null ? element.selectionEnd : element.value.length;
        const value = element.value || '';
        element.value = value.substring(0, start) + text + value.substring(end);
        element.selectionStart = element.selectionEnd = start + text.length;
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (e) {
        return false;
      }
    } else if (element.contentEditable === 'true' || element.isContentEditable) {
      try {
        element.focus();
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          const fragment = document.createDocumentFragment();
          const lines = text.split('\n');
          
          lines.forEach((line, index) => {
            if (index > 0) {
              fragment.appendChild(document.createElement('br'));
            }
            if (line === '') {
              fragment.appendChild(document.createTextNode('\u00A0'));
            } else {
              const textNode = document.createTextNode(line);
              fragment.appendChild(textNode);
            }
          });
          
          range.insertNode(fragment);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          element.innerText = (element.innerText || '') + text;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
  
  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    if (element.offsetParent === null && style.position !== 'fixed') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  
  function scoreElement(element) {
    if (!isElementVisible(element)) return 0;
    const rect = element.getBoundingClientRect();
    let score = 0;
    
    if (element.tagName === 'TEXTAREA') score += 100;
    if (element.tagName === 'INPUT' && (element.type === 'text' || !element.type)) score += 80;
    if (element.contentEditable === 'true' || element.isContentEditable) score += 70;
    if (element.getAttribute('role') === 'textbox') score += 60;
    if (element.hasAttribute('placeholder')) score += 20;
    if (rect.width > 300) score += 30;
    if (rect.height > 50) score += 30;
    if (rect.width > 500) score += 20;
    if (rect.height > 100) score += 20;
    
    return score;
  }
  
  if (activeElement && tryInsert(activeElement)) {
    inserted = true;
  } else {
    const genericSelectors = [
      'textarea',
      'input[type="text"]',
      'input:not([type])',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'div[contenteditable]',
      '[data-placeholder]',
      '[placeholder]'
    ];
    
    const candidates = [];
    
    for (const selector of genericSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (isElementVisible(el)) {
            const score = scoreElement(el);
            if (score > 0) {
              candidates.push({ element: el, score: score });
            }
          }
        });
      } catch (e) {
      }
    }
    
    candidates.sort((a, b) => b.score - a.score);
    
    for (const candidate of candidates) {
      candidate.element.focus();
      candidate.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (tryInsert(candidate.element)) {
        inserted = true;
        break;
      }
    }
  }
  
  return inserted;
}
