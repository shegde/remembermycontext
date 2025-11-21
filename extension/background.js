
importScripts('config-shared.js');

const USE_LOCAL = ENV_CONFIG.USE_LOCAL;
const PRODUCTION_API = ENV_CONFIG.PRODUCTION_API;
const LOCAL_API = ENV_CONFIG.LOCAL_API;

const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    DELAY_MS: 200
};

const ELEMENT_SCORES = {
    TEXTAREA: 100,
    TEXT_INPUT: 80,
    CONTENTEDITABLE: 70,
    TEXTBOX_ROLE: 60,
    HAS_PLACEHOLDER: 20,
    WIDTH_LARGE: 30,
    HEIGHT_LARGE: 30,
    WIDTH_XLARGE: 20,
    HEIGHT_XLARGE: 20
};

const SIZE_THRESHOLDS = {
    WIDTH_LARGE: 300,
    HEIGHT_LARGE: 50,
    WIDTH_XLARGE: 500,
    HEIGHT_XLARGE: 100
};

const CHROME_PROTOCOLS = ['chrome://', 'chrome-extension://', 'edge://'];
const CHROME_NEWTAB = 'chrome://newtab/';

const INPUT_SELECTORS = [
    'textarea',
    'input[type="text"]',
    'input:not([type])',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[contenteditable]',
    '[data-placeholder]',
    '[placeholder]'
];

/**
 * Handles extension installation and updates
 * Sends analytics event and configures side panel
 */
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

/**
 * Opens side panel when extension icon is clicked
 * Falls back to standard popup if side panel API is unavailable
 */
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

/**
 * Notifies popup when user switches tabs
 * Used for syncing UI state across tab changes
 */
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

/**
 * Notifies popup when tab URL changes
 * Used for detecting navigation within same tab
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    chrome.runtime.sendMessage({
      action: "tabChanged",
      tabId: tabId,
      url: changeInfo.url
    }).catch(() => {});
  }
});

/**
 * Handles text insertion requests from popup
 * Finds active tab and injects text into LLM input field
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertText") {
    (async () => {
      try {
        let activeTab = null;
        let retries = RETRY_CONFIG.MAX_RETRIES;
        
        while (retries > 0 && !activeTab) {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          
          if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            const isValidTab = tab.url && 
                               tab.url !== CHROME_NEWTAB && 
                               !CHROME_PROTOCOLS.some(proto => tab.url.startsWith(proto));
            
            if (isValidTab) {
              activeTab = tab;
              break;
            }
          }
          
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.DELAY_MS));
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

/**
 * Inserts text into the active input element on the page
 * Tries multiple strategies: active element, then searches for best candidate
 * @param {string} text - The text to insert
 * @returns {boolean} True if insertion successful, false otherwise
 */
function insertTextIntoActiveElement(text) {
  let inserted = false;
  const activeElement = document.activeElement;
  
  /**
   * Attempts to insert text into a specific element
   * @param {HTMLElement} element - Target element
   * @returns {boolean} Success status
   */
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
  
  /**
   * Checks if an element is visible and interactable
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if visible
   */
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
  
  /**
   * Scores an element based on likelihood of being the correct input field
   * Higher score = better candidate
   * @param {HTMLElement} element - Element to score
   * @returns {number} Score value
   */
  function scoreElement(element) {
    if (!isElementVisible(element)) return 0;
    const rect = element.getBoundingClientRect();
    let score = 0;
    
    const SCORES = {
      TEXTAREA: 100,
      TEXT_INPUT: 80,
      CONTENTEDITABLE: 70,
      TEXTBOX_ROLE: 60,
      HAS_PLACEHOLDER: 20,
      WIDTH_LARGE: 30,
      HEIGHT_LARGE: 30,
      WIDTH_XLARGE: 20,
      HEIGHT_XLARGE: 20
    };
    
    const THRESHOLDS = {
      WIDTH_LARGE: 300,
      HEIGHT_LARGE: 50,
      WIDTH_XLARGE: 500,
      HEIGHT_XLARGE: 100
    };
    
    if (element.tagName === 'TEXTAREA') score += SCORES.TEXTAREA;
    if (element.tagName === 'INPUT' && (element.type === 'text' || !element.type)) score += SCORES.TEXT_INPUT;
    if (element.contentEditable === 'true' || element.isContentEditable) score += SCORES.CONTENTEDITABLE;
    if (element.getAttribute('role') === 'textbox') score += SCORES.TEXTBOX_ROLE;
    if (element.hasAttribute('placeholder')) score += SCORES.HAS_PLACEHOLDER;
    if (rect.width > THRESHOLDS.WIDTH_LARGE) score += SCORES.WIDTH_LARGE;
    if (rect.height > THRESHOLDS.HEIGHT_LARGE) score += SCORES.HEIGHT_LARGE;
    if (rect.width > THRESHOLDS.WIDTH_XLARGE) score += SCORES.WIDTH_XLARGE;
    if (rect.height > THRESHOLDS.HEIGHT_XLARGE) score += SCORES.HEIGHT_XLARGE;
    
    return score;
  }
  
  if (activeElement && tryInsert(activeElement)) {
    inserted = true;
  } else {
    const genericSelectors = INPUT_SELECTORS;
    
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
