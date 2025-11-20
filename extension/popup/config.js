const CONFIG_STORAGE_KEY = 'remembermycontext_config';

const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://remembermycontexttest.onrender.com/api/v1',
    isProduction: true,
    calendlyLink: ''
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
    // For Chrome extension, always use production by default
    // Users can manually switch to dev if needed
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        // Check if user has explicitly set dev mode
        // For now, default to production
        return DEFAULT_CONFIG;
    }
    
    // Fallback for non-extension contexts
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

