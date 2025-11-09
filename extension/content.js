chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlightActiveElement") {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || 
                         activeElement.tagName === 'INPUT' || 
                         activeElement.contentEditable === 'true')) {
      
      const originalBorder = activeElement.style.border;
      const originalBoxShadow = activeElement.style.boxShadow;
      
      activeElement.style.border = '2px solid #007bff';
      activeElement.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.3)';
      
      setTimeout(() => {
        activeElement.style.border = originalBorder;
        activeElement.style.boxShadow = originalBoxShadow;
      }, 2000);
    }
  }
});
