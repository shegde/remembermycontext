const CONFIG_STORAGE_KEY = 'remembermycontext_config';

const PRODUCTION_CONFIG = {
    apiBaseUrl: ENV_CONFIG.PRODUCTION_API,
    isProduction: true,
    calendlyLink: 'https://cal.com/shailesh-hegde-arsvcf/remembermycontext'
};

const LOCAL_CONFIG = {
    apiBaseUrl: ENV_CONFIG.LOCAL_API,
    isProduction: false,
    calendlyLink: 'https://cal.com/shailesh-hegde-arsvcf/remembermycontext'
};

/**
 * Retrieves configuration from storage or creates default config
 * @returns {Promise<Object>} Configuration object with apiBaseUrl and calendlyLink
 */
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
        return USE_LOCAL ? LOCAL_CONFIG : PRODUCTION_CONFIG;
    }
}

/**
 * Detects environment based on USE_LOCAL flag
 * @returns {Object} Environment configuration
 */
function detectEnvironment() {
    return ENV_CONFIG.USE_LOCAL ? LOCAL_CONFIG : PRODUCTION_CONFIG;
}

/**
 * Updates configuration in storage
 * @param {Object} newConfig - New configuration object
 * @returns {Promise<boolean>} Success status
 */
async function updateConfig(newConfig) {
    try {
        await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: newConfig });
        return true;
    } catch (error) {
        return false;
    }
}

