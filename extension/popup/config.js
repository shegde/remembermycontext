const CONFIG_STORAGE_KEY = 'remembermycontext_config';

const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://your-render-app.onrender.com/api/v1',
    isProduction: true
};

async function getConfig() {
    try {
        const stored = await chrome.storage.local.get([CONFIG_STORAGE_KEY]);
        if (stored[CONFIG_STORAGE_KEY]) {
            return stored[CONFIG_STORAGE_KEY];
        }
        
        const detectedConfig = detectEnvironment();
        await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: detectedConfig });
        return detectedConfig;
    } catch (error) {
        return DEFAULT_CONFIG;
    }
}

function detectEnvironment() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        const isDev = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.protocol === 'chrome-extension:';
        
        if (isDev) {
            return {
                apiBaseUrl: 'http://localhost:8000/api/v1',
                isProduction: false
            };
        }
    }
    
    return DEFAULT_CONFIG;
}

async function updateConfig(newConfig) {
    try {
        await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: newConfig });
        return true;
    } catch (error) {
        return false;
    }
}

