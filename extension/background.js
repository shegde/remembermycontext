// Track installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    // Track installation event
    chrome.storage.local.get(['apiBase'], (result) => {
      const API_BASE = result.apiBase || 'https://remembermycontext-api.onrender.com/api/v1';
      
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
      }).catch(error => {
        console.log('Failed to track installation:', error);
      });
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insertText") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: insertTextIntoActiveElement,
          args: [request.text]
        }).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }
});

function insertTextIntoActiveElement(text) {
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'TEXTAREA' || 
                       activeElement.tagName === 'INPUT' || 
                       activeElement.contentEditable === 'true')) {
    
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const value = activeElement.value;
      activeElement.value = value.substring(0, start) + text + value.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
    } else if (activeElement.contentEditable === 'true') {
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
      }
    }
    
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
