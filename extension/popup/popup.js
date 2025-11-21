let API_BASE = '';
let currentUser = null;
let currentBox = null;
let contextsCache = {};

const LLM_SITES = [
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'platform.openai.com',
    'claude.ai',
    'chat.anthropic.com',
    'anthropic.com',
    'gemini.google.com',
    'bard.google.com',
    'deepmind.google',
    'ai.google.dev',
    'meta.ai',
    'llama.meta.com',
    'x.ai',
    'grok.x.ai',
    'mistral.ai',
    'chat.mistral.ai',
    'console.mistral.ai',
    'deepseek.com',
    'platform.deepseek.com',
    'cohere.com',
    'dashboard.cohere.com',
    'qwen.ai',
    'tongyi.aliyun.com',
    'yiyan.baidu.com',
    'baidu.com',
    'zhipu.ai',
    'chatglm.cn',
    'sensetime.com',
    'chat.sensetime.com',
    'xinghuo.xfyun.cn',
    'huawei.com',
    'ai21.com',
    'studio.ai21.com',
    'stability.ai',
    'aleph-alpha.com',
    'reka.ai',
    'writer.com',
    'snowflake.com',
    'databricks.com',
    'mosaicml.com',
    'perplexity.ai',
    'www.perplexity.ai',
    'poe.com',
    'character.ai',
    'you.com',
    'phind.com',
    'www.phind.com',
    'copilot.microsoft.com',
    'bing.com',
    'www.bing.com'
];

/**
 * Maps a hostname to its LLM display name
 * @param {string} hostname - The domain name to match
 * @returns {string|null} LLM name or null if not found
 */
function getLLMName(hostname) {
    if (!hostname) return null;
    let hostnameLower = hostname.toLowerCase().trim();
    hostnameLower = hostnameLower.replace(/^www\./, '');
    
    const sortedSites = [...LLM_SITES].sort((a, b) => {
        const aClean = a.toLowerCase().replace(/^www\./, '').trim();
        const bClean = b.toLowerCase().replace(/^www\./, '').trim();
        return bClean.length - aClean.length;
    });
    
    for (const llmSite of sortedSites) {
        let siteClean = llmSite.toLowerCase().trim();
        siteClean = siteClean.replace(/^www\./, '');
        
        if (hostnameLower === siteClean) {
            return siteClean;
        }
        
        if (hostnameLower.endsWith('.' + siteClean)) {
            return siteClean;
        }
        
        const regex = new RegExp('(^|\\.)' + siteClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\.|$)', 'i');
        if (regex.test(hostnameLower)) {
            return siteClean;
        }
    }
    
    return null;
}

/**
 * Makes an authenticated API call to the backend
 * Automatically handles token refresh on 401 errors
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function apiCall(url, options = {}) {
    const response = await fetch(url, options);
    
    if (response.status === 401 || response.status === 403) {
        if (currentUser) {
            await handleLogout();
            showToast('Session expired. Please login again.', 'error');
        }
        return null;
    }
    
    return response;
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializeConfig();
    await initializeApp();
    setupEventListeners();
});

/**
 * Initializes extension configuration from storage
 * Sets up API base URL based on environment
 */
async function initializeConfig() {
    const config = await getConfig();
    API_BASE = config.apiBaseUrl;
    const calendlyLink = document.getElementById('feedback-calendly-link');
    if (calendlyLink && config.calendlyLink && config.calendlyLink.trim()) {
        calendlyLink.href = config.calendlyLink;
    }
}

/**
 * Main initialization function
 * Sets up config, checks auth status, loads data, and attaches event listeners
 */
async function initializeApp() {
    const user = await chrome.storage.local.get(['user']);
    if (user.user && user.user.access_token) {
        try {
            const testResponse = await fetch(`${API_BASE}/contexts`, {
                headers: { 'Authorization': `Bearer ${user.user.access_token}` }
            });
            
            if (testResponse.ok || testResponse.status === 404) {
                currentUser = user.user;
                const onboardingStatus = await checkOnboardingStatus();
                if (!onboardingStatus || !onboardingStatus.completed) {
                    showScreen('onboarding-1');
            } else {
                showScreen('main');
                loadContexts();
                const lastBox = await chrome.storage.local.get(['lastContextBox']);
                if (lastBox.lastContextBox) {
                    currentBox = lastBox.lastContextBox;
                    showVersions();
                }
            }
            } else if (testResponse.status === 401 || testResponse.status === 403) {
                await handleLogout();
                showScreen('welcome');
            } else {
                currentUser = user.user;
                showScreen('main');
                loadContexts();
                const lastBox = await chrome.storage.local.get(['lastContextBox']);
                if (lastBox.lastContextBox) {
                    currentBox = lastBox.lastContextBox;
                    showVersions();
                }
            }
        } catch (error) {
            await handleLogout();
            showScreen('welcome');
        }
    } else {
        showScreen('welcome');
    }
}

function safeAddEventListener(id, event, handler) {
    try {
        const element = document.getElementById(id);
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler);
        }
    } catch (error) {
    }
}

function setupEventListeners() {
    safeAddEventListener('create-account-btn', 'click', () => showScreen('signup'));
    safeAddEventListener('login-btn', 'click', () => showScreen('login'));
    safeAddEventListener('signup-login-link', 'click', () => showScreen('login'));
    safeAddEventListener('login-signup-link', 'click', () => showScreen('signup'));
    
    safeAddEventListener('signup-submit', 'click', handleSignup);
    safeAddEventListener('login-submit', 'click', handleLogin);
    
    safeAddEventListener('dashboard-btn', 'click', async () => {
        const dashboardUrl = API_BASE.replace('/api/v1', '/dashboard');
        if (currentUser && currentUser.access_token) {
            const url = new URL(dashboardUrl);
            url.searchParams.set('token', currentUser.access_token);
            chrome.tabs.create({ url: url.toString() });
        } else {
            chrome.tabs.create({ url: dashboardUrl });
        }
    });
    
    safeAddEventListener('logout-link', 'click', handleLogout);
    
    document.querySelectorAll('.context-box').forEach(box => {
        box.addEventListener('click', (e) => {
            currentBox = e.currentTarget.dataset.box;
            showVersions();
        });
    });
    
    safeAddEventListener('versions-back-btn', 'click', () => showScreen('main'));
    safeAddEventListener('edit-latest-btn', 'click', () => showEdit());
    safeAddEventListener('edit-cancel-btn', 'click', () => showVersions());
    safeAddEventListener('edit-save-btn', 'click', handleSave);
    
    safeAddEventListener('upgrade-link', 'click', (e) => {
        e.preventDefault();
        showUpgrade();
    });
    safeAddEventListener('upgrade-back-btn', 'click', () => showScreen('main'));
    safeAddEventListener('upgrade-maybe-later-btn', 'click', () => showScreen('main'));
    
    const feedbackCalendlyLink = document.getElementById('feedback-calendly-link');
    if (feedbackCalendlyLink) {
        feedbackCalendlyLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const config = await getConfig();
            const calendlyUrl = config.calendlyLink || 'https://calendly.com';
            chrome.tabs.create({ url: calendlyUrl });
        });
    }
    
    safeAddEventListener('feedback-link', 'click', (e) => {
        e.preventDefault();
        showScreen('feedback');
    });
    
    safeAddEventListener('settings-link', 'click', (e) => {
        e.preventDefault();
        showSettings();
    });
    
    safeAddEventListener('login-forgot-link', 'click', () => {
        const email = document.getElementById('login-email').value.trim();
        showScreen('forgot-password');
        updateForgotPasswordEmail(email);
    });
    
    safeAddEventListener('forgot-password-back-btn', 'click', () => {
        showScreen('login');
    });
    
    function updateForgotPasswordEmail(email) {
        const emailInput = document.getElementById('forgot-password-email');
        if (emailInput) {
            emailInput.value = email || '';
        }
    }
    
    safeAddEventListener('forgot-password-submit', 'click', handleForgotPassword);
    safeAddEventListener('reset-password-submit', 'click', handleResetPassword);
    
    safeAddEventListener('onboarding-1-next', 'click', () => showScreen('onboarding-2'));
    safeAddEventListener('onboarding-1-skip', 'click', handleSkipOnboarding);
    safeAddEventListener('onboarding-2-back', 'click', () => showScreen('onboarding-1'));
    safeAddEventListener('onboarding-2-next', 'click', () => showScreen('onboarding-3'));
    safeAddEventListener('onboarding-2-skip', 'click', handleSkipOnboarding);
    safeAddEventListener('onboarding-3-back', 'click', () => showScreen('onboarding-2'));
    safeAddEventListener('onboarding-3-skip', 'click', handleSkipOnboarding);
    safeAddEventListener('onboarding-3-complete', 'click', handleCompleteOnboarding);
    
    safeAddEventListener('resend-verification-btn', 'click', handleResendVerification);
    safeAddEventListener('verification-back-btn', 'click', () => showScreen('login'));
    
    safeAddEventListener('settings-back-btn', 'click', () => showScreen('main'));
    safeAddEventListener('settings-logout-btn', 'click', handleLogout);
    safeAddEventListener('settings-reset-password-btn', 'click', () => {
        if (!currentUser) {
            showScreen('welcome');
            return;
        }
        showScreen('change-password');
    });
    
    safeAddEventListener('change-password-back-btn', 'click', () => {
        showScreen('settings');
    });
    
    safeAddEventListener('change-password-submit', 'click', handleChangePassword);
    safeAddEventListener('delete-account-btn', 'click', handleDeleteAccount);
    safeAddEventListener('cancel-deletion-btn', 'click', handleCancelDeletion);
    
    safeAddEventListener('feedback-back-btn', 'click', () => showScreen('main'));
    safeAddEventListener('feedback-cancel-btn', 'click', () => showScreen('main'));
    safeAddEventListener('feedback-submit-btn', 'click', handleSubmitFeedback);
    
    safeAddEventListener('upgrade-submit-btn', 'click', handleUpgradeInterest);
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById(screenName + '-screen');
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (!validatePassword(password)) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
    }
    
    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.email_verification_required || data.message?.toLowerCase().includes('verify')) {
                showScreen('email-verification');
                document.getElementById('login-email').value = email;
                showToast('Account created! Please check your email to verify your account.', 'success');
                return;
            } else {
                try {
                    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    if (loginResponse.ok) {
                        const loginData = await loginResponse.json();
                        currentUser = { email, access_token: loginData.access_token };
                        await chrome.storage.local.set({ user: currentUser });
                        showScreen('onboarding-1');
                    } else {
                        showToast('Account created! Please log in.', 'success');
                        showScreen('login');
                        document.getElementById('login-email').value = email;
                    }
                } catch (error) {
                    showToast('Account created! Please log in.', 'success');
                    showScreen('login');
                    document.getElementById('login-email').value = email;
                }
            }
        } else {
            const errorMsg = await parseApiError(response, 'Registration failed');
            showToast(sanitizeError(errorMsg, 'Registration failed. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (!password) {
        showToast('Please enter your password', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = { email, access_token: data.access_token };
            await chrome.storage.local.set({ user: currentUser });
            
            const onboardingStatus = await checkOnboardingStatus();
            if (!onboardingStatus || !onboardingStatus.completed) {
                showScreen('onboarding-1');
            } else {
                showScreen('main');
                await loadContexts();
            }
            showToast('Login successful!');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.detail?.message || errorData.message || 'Login failed';
            const errorCode = errorData.detail?.error_code;
            
            if (response.status === 401 && errorCode === 'EMAIL_NOT_VERIFIED') {
                showScreen('email-verification');
                if (email) {
                    document.getElementById('login-email').value = email;
                }
                showToast('Please verify your email before logging in.', 'error');
            } else {
                showToast(errorMsg, 'error');
            }
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleLogout() {
    await chrome.storage.local.remove(['user']);
    currentUser = null;
    contextsCache = {};
    showScreen('welcome');
}

async function loadContexts() {
    if (!currentUser) {
        showScreen('welcome');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/contexts`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const contexts = await response.json();
            contextsCache = {};
            contexts.forEach(context => {
                contextsCache[context.box_name] = context;
            });
            updateContextBoxes();
        } else if (response.status === 401 || response.status === 403) {
            await handleLogout();
            showToast('Session expired. Please login again.', 'error');
        }
    } catch (error) {
        if (!currentUser || !currentUser.access_token) {
            showScreen('welcome');
        }
    }
}

function updateContextBoxes() {
    const boxes = ['Career', 'Work', 'Health', 'Travel', 'Custom'];
    boxes.forEach(boxName => {
        const boxElement = document.querySelector(`[data-box="${boxName}"]`);
        const context = contextsCache[boxName];
        
        if (context) {
            const lastUsed = context.last_used_at ? 
                formatDateTime(context.last_used_at) : 'Never used';
            boxElement.querySelector('.context-box-meta').textContent = 
                `${context.versions_count} versions • Last used ${lastUsed}`;
        } else {
            boxElement.querySelector('.context-box-meta').textContent = '0 versions • Never used';
        }
    });
}

function showVersions() {
    document.getElementById('versions-box-name').textContent = 
        `${getBoxEmoji(currentBox)} ${currentBox} Context`;
    showScreen('versions');
    loadVersions();
    chrome.storage.local.set({ lastContextBox: currentBox });
}

function getBoxEmoji(boxName) {
    const emojis = {
        'Career': '💼',
        'Work': '🏢',
        'Health': '🏥',
        'Travel': '✈️',
        'Custom': '⚙️'
    };
    return emojis[boxName] || '📁';
}

async function loadVersions() {
    if (!currentUser || !currentBox) return;
    
    try {
        const response = await fetch(`${API_BASE}/contexts/${currentBox}/versions`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const versions = await response.json();
            displayVersions(versions);
        }
    } catch (error) {
        showToast('Failed to load versions', 'error');
    }
}

function displayVersions(versions) {
    const container = document.getElementById('versions-list');
    container.innerHTML = '';
    
    const editBtn = document.getElementById('edit-latest-btn');
    if (editBtn) {
        if (!versions || versions.length === 0) {
            editBtn.textContent = 'Create';
        } else {
            editBtn.textContent = 'Edit Latest';
        }
    }
    
    if (!versions || versions.length === 0) {
        const emptyMsg = createElement('div', 'info-box', 'No versions yet');
        container.appendChild(emptyMsg);
        return;
    }
    
    const latestVersionNumber = Math.max(...versions.map(v => v.version_number));
    
    versions.forEach(version => {
        const versionElement = createElement('div', 'version-item');
        
        const header = createElement('div', 'version-header');
        
        const leftDiv = createElement('div');
        const versionStrong = createElement('strong');
        versionStrong.textContent = `v${version.version_number}`;
        leftDiv.appendChild(versionStrong);
        
        if (version.version_number === latestVersionNumber) {
            const latestBadge = createElement('span', null, '(Latest)');
            latestBadge.style.marginLeft = '10px';
            latestBadge.style.color = '#28a745';
            leftDiv.appendChild(latestBadge);
        }
        
        const dateDiv = createElement('div');
        dateDiv.style.fontSize = '11px';
        dateDiv.style.color = '#666';
        dateDiv.textContent = formatDateTime(version.created_at);
        leftDiv.appendChild(dateDiv);
        
        const buttonDiv = createElement('div');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '5px';
        
        const copyBtn = createElement('button', 'btn btn-success copy-btn');
        copyBtn.textContent = 'Copy';
        copyBtn.style.padding = '5px 10px';
        copyBtn.style.fontSize = '12px';
        copyBtn.dataset.box = currentBox;
        copyBtn.dataset.version = version.version_number.toString();
        copyBtn.addEventListener('click', () => {
            copyVersion(currentBox, version.version_number);
        });
        
        const insertBtn = createElement('button', 'btn btn-primary insert-btn');
        insertBtn.textContent = 'Insert';
        insertBtn.style.padding = '5px 10px';
        insertBtn.style.fontSize = '12px';
        insertBtn.dataset.box = currentBox;
        insertBtn.dataset.version = version.version_number.toString();
        insertBtn.addEventListener('click', () => {
            insertVersion(currentBox, version.version_number);
        });
        
        buttonDiv.appendChild(copyBtn);
        buttonDiv.appendChild(insertBtn);
        
        header.appendChild(leftDiv);
        header.appendChild(buttonDiv);
        
        const usageStats = createElement('div', 'usage-stats');
        let lastUsedText = 'Never';
        if (version.last_used_at) {
            const lastUsedDate = formatDateTime(version.last_used_at);
            if (version.last_llm_used && version.last_llm_used.trim()) {
                lastUsedText = `Last used on ${version.last_llm_used} at ${lastUsedDate}`;
            } else {
                lastUsedText = `Last used at ${lastUsedDate}`;
            }
        }
        usageStats.textContent = `📊 Used ${version.uses_count} times • ${lastUsedText}`;
        
        versionElement.appendChild(header);
        versionElement.appendChild(usageStats);
        container.appendChild(versionElement);
    });
}

async function copyVersion(boxName, versionNumber) {
    try {
        const response = await fetch(`${API_BASE}/contexts/${boxName}/versions/${versionNumber}`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const decryptedText = await decryptText(data.ciphertext);
            await navigator.clipboard.writeText(decryptedText);
            showToast('Copied to clipboard!');
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentSite = tabs[0] ? new URL(tabs[0].url).hostname : 'unknown';
            const llmName = getLLMName(currentSite);
            
            await fetch(`${API_BASE}/contexts/${boxName}/versions/${versionNumber}/mark_used`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ site: currentSite, llm_name: llmName })
            });
            
            await fetch(`${API_BASE}/analytics`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    event_type: 'copy',
                    metadata: { box_name: boxName, version_number: versionNumber, site: currentSite }
                })
            });
        }
    } catch (error) {
        showToast('Failed to copy', 'error');
    }
}

async function insertVersion(boxName, versionNumber) {
    try {
        const response = await fetch(`${API_BASE}/contexts/${boxName}/versions/${versionNumber}`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const decryptedText = await decryptText(data.ciphertext);
            
            let activeTab = null;
            let retries = RETRY_CONFIG.MAX_RETRIES;
            
            while (retries > 0 && !activeTab) {
                try {
                    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                    
                    if (tabs && tabs.length > 0) {
                        const tab = tabs[0];
                        const isValidTab = tab.url && 
                                          tab.url !== CHROME_NEWTAB && 
                                          !CHROME_PROTOCOLS.some(proto => tab.url.startsWith(proto));
                        
                        if (isValidTab) {
                            activeTab = tab;
                        }
                    }
                    
                    if (activeTab) break;
                } catch (e) {
                }
                
                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.DELAY_MS));
                }
            }
            
            if (!activeTab || !activeTab.url) {
                showToast('No active tab found. Please open an LLM site first.', 'error');
                return;
            }
            
            if (activeTab.url === 'chrome://newtab/' || activeTab.url.startsWith('chrome://') || 
                activeTab.url.startsWith('chrome-extension://') || activeTab.url.startsWith('edge://')) {
                showToast('Please open an LLM site (ChatGPT, Claude, Perplexity, Mistral, etc.) first.', 'error');
                return;
            }
            
            let currentSite;
            try {
                const url = new URL(activeTab.url);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    showToast('Cannot insert into Chrome pages. Please open an LLM site first.', 'error');
                    return;
                }
                currentSite = url.hostname.toLowerCase().replace(/^www\./, '');
            } catch (e) {
                showToast('Invalid URL. Please open an LLM site first.', 'error');
                return;
            }
            
            const llmName = getLLMName(currentSite);
            
            if (!llmName) {
                showToast(`Please open an LLM site first. (Current: ${currentSite})`, 'error');
                return;
            }
            
            try {
                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: "insertText",
                        text: decryptedText
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                            resolve(response || { success: false, error: 'insert_failed' });
                        }
                    });
                });
                
                if (result && result.success) {
                    showToast('Text inserted successfully!', 'success');
                } else {
                    const errorMsg = result?.error === 'insert_failed' 
                        ? 'Could not find input field. Try clicking it first.'
                        : sanitizeError(result?.error, 'Failed to insert text. Please try again.');
                    showToast(errorMsg, 'error');
                }
            } catch (error) {
                showToast(sanitizeError(error, 'Failed to insert text. Please try again.'), 'error');
            }
            
            await fetch(`${API_BASE}/contexts/${boxName}/versions/${versionNumber}/mark_used`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ site: currentSite, llm_name: llmName })
            });
            
            if (llmName) {
                await fetch(`${API_BASE}/analytics`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${currentUser.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        event_type: 'insert',
                        metadata: { box_name: boxName, version_number: versionNumber, site: currentSite, llm: llmName }
                    })
                });
            }
        }
    } catch (error) {
        showToast('Failed to insert', 'error');
    }
}

/**
 * Decrypts context text using user's encryption key
 * @param {string} ciphertext - Encrypted text from backend
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decryptText(ciphertext) {
    try {
        const response = await fetch(`${API_BASE}/contexts/decrypt`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ciphertext })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.plaintext;
        }
        return ciphertext;
    } catch (error) {
        return ciphertext;
    }
}

async function showEdit() {
    document.getElementById('edit-box-name').textContent = `Edit: ${getBoxEmoji(currentBox)} ${currentBox}`;
    const context = contextsCache[currentBox];
    const latestVersion = context?.latest_version_number || 0;
    document.getElementById('next-version').textContent = latestVersion + 1;
    
    if (latestVersion >= 0 && context && context.versions_count > 0) {
        try {
            const response = await fetch(`${API_BASE}/contexts/${currentBox}/versions/${latestVersion}`, {
                headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const decryptedText = await decryptText(data.ciphertext);
                document.getElementById('context-text').value = decryptedText;
            }
        } catch (error) {
        }
    } else {
        document.getElementById('context-text').value = '';
    }
    
    showScreen('edit');
}

async function handleSave() {
    const text = document.getElementById('context-text').value.trim();
    
    if (!text) {
        showToast('Please enter some context', 'error');
        return;
    }
    
    if (!currentUser || !currentUser.access_token) {
        showToast('Please login first', 'error');
        showScreen('welcome');
        return;
    }
    
    if (!currentBox) {
        showToast('No context box selected', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/contexts/${currentBox}/versions`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            showToast('Context saved!');
            await loadContexts();
            showVersions();
        } else {
            const errorMsg = await parseApiError(response, 'Failed to save');
            showToast(sanitizeError(errorMsg, 'Failed to save. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function checkOnboardingStatus() {
    if (!currentUser || !currentUser.access_token) return null;
    
    try {
        const response = await fetch(`${API_BASE}/onboarding/status`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
    }
    return null;
}

async function handleCompleteOnboarding() {
    if (!currentUser || !currentUser.access_token) return;
    
    try {
        await fetch(`${API_BASE}/analytics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'onboarding_step_completed',
                metadata: {step: 'final'}
            })
        }).catch(() => {});
        
        const response = await fetch(`${API_BASE}/onboarding/complete`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showScreen('main');
            await loadContexts();
            showToast('Welcome! Let\'s get started.');
        }
    } catch (error) {
        showToast('Failed to complete onboarding', 'error');
    }
}

async function handleSkipOnboarding() {
    if (!currentUser || !currentUser.access_token) {
        showScreen('main');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/analytics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'onboarding_skipped',
                metadata: {}
            })
        }).catch(() => {});
        
        const response = await fetch(`${API_BASE}/onboarding/complete`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showScreen('main');
            await loadContexts();
        } else {
            showScreen('main');
            await loadContexts();
        }
    } catch (error) {
        showScreen('main');
        await loadContexts();
    }
}

async function handleForgotPassword() {
    const emailInput = document.getElementById('forgot-password-email');
    const email = emailInput?.value?.trim() || '';
    
    if (!email || !validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            showToast('Password reset link sent! Check your email.', 'success');
            showScreen('login');
        } else {
            const errorMsg = await parseApiError(response, 'Failed to send reset link');
            showToast(sanitizeError(errorMsg, 'Failed to send reset link. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleResetPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        showToast('Invalid reset token', 'error');
        return;
    }
    
    const newPassword = document.getElementById('reset-password-new').value;
    const confirm = document.getElementById('reset-password-confirm').value;
    
    if (!validatePassword(newPassword)) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
    }
    
    if (newPassword !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: newPassword })
        });
        
        if (response.ok) {
            showToast('Password reset successful! Please login.', 'success');
            showScreen('login');
        } else {
            const errorMsg = await parseApiError(response, 'Failed to reset password');
            showToast(sanitizeError(errorMsg, 'Failed to reset password. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleChangePassword() {
    if (!currentUser || !currentUser.access_token) {
        showToast('Please log in first', 'error');
        showScreen('welcome');
        return;
    }
    
    const currentPassword = document.getElementById('change-password-current').value.trim();
    const newPassword = document.getElementById('change-password-new').value.trim();
    const confirmPassword = document.getElementById('change-password-confirm').value.trim();
    
    if (!currentPassword) {
        showToast('Please enter your current password', 'error');
        return;
    }
    
    if (!newPassword) {
        showToast('Please enter a new password', 'error');
        return;
    }
    
    if (!validatePassword(newPassword)) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
    }
    
    if (!/.*[a-zA-Z].*/.test(newPassword)) {
        showToast('Password must contain at least one letter', 'error');
        return;
    }
    
    if (!/.*[0-9].*/.test(newPassword)) {
        showToast('Password must contain at least one digit', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New password and confirm password do not match', 'error');
        return;
    }
    
    if (currentPassword === newPassword) {
        showToast('New password must be different from current password', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.access_token}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        
        if (response.ok) {
            showToast('Password changed successfully! Please log in again.', 'success');
            document.getElementById('change-password-current').value = '';
            document.getElementById('change-password-new').value = '';
            document.getElementById('change-password-confirm').value = '';
            await handleLogout();
            showScreen('login');
        } else {
            const errorMsg = await parseApiError(response, 'Failed to change password');
            showToast(sanitizeError(errorMsg, 'Failed to change password. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleResendVerification() {
    let email = currentUser?.email;
    if (!email) {
        email = document.getElementById('login-email')?.value?.trim();
    }
    if (!email) {
        email = document.getElementById('signup-email')?.value?.trim();
    }
    
    if (!email) {
        showToast('Please enter your email address', 'error');
        showScreen('login');
        return;
    }
    
    const btn = document.getElementById('resend-verification-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending...';
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            showToast('Verification email sent! Please check your inbox and spam folder.', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.detail?.message || errorData.message || 'Failed to send verification email';
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = 'Resend Verification Email';
            }, 5000);
        }
    }
}

function showUpgrade() {
    if (!currentUser) {
        showScreen('welcome');
        return;
    }
    
    const userEmail = currentUser.email || 'user@example.com';
    document.getElementById('upgrade-display-email').textContent = userEmail;
    document.getElementById('upgrade-email').value = userEmail;
    showScreen('upgrade');
}

async function showSettings() {
    if (!currentUser) {
        showScreen('welcome');
        return;
    }
    
    document.getElementById('settings-email').textContent = currentUser.email || 'user@example.com';
    document.getElementById('upgrade-email').value = currentUser.email || 'user@example.com';
    
    try {
        const response = await fetch(`${API_BASE}/auth/check-deletion`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.deletion_requested) {
                document.getElementById('deletion-pending-info').style.display = 'block';
                document.getElementById('delete-account-btn').style.display = 'none';
            } else {
                document.getElementById('deletion-pending-info').style.display = 'none';
                document.getElementById('delete-account-btn').style.display = 'block';
            }
        }
    } catch (error) {
    }
    
    showScreen('settings');
}

async function handleDeleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    
    if (!currentUser || !currentUser.access_token) return;
    
    try {
        const response = await fetch(`${API_BASE}/auth/request-deletion`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            showToast('Account deletion requested. You have 7 days to cancel.', 'success');
            document.getElementById('deletion-pending-info').style.display = 'block';
            document.getElementById('delete-account-btn').style.display = 'none';
        } else {
            const errorMsg = await parseApiError(response, 'Failed to request deletion');
            showToast(sanitizeError(errorMsg, 'Failed to request deletion. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleCancelDeletion() {
    if (!currentUser || !currentUser.access_token) return;
    
    try {
        const response = await fetch(`${API_BASE}/auth/cancel-deletion`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            showToast('Account deletion cancelled.', 'success');
            document.getElementById('deletion-pending-info').style.display = 'none';
            document.getElementById('delete-account-btn').style.display = 'block';
        } else {
            const errorMsg = await parseApiError(response, 'Failed to cancel deletion');
            showToast(sanitizeError(errorMsg, 'Failed to cancel deletion. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    }
}

async function handleSubmitFeedback() {
    let type = document.getElementById('feedback-type').value;
    const message = document.getElementById('feedback-message').value.trim();
    
    if (!message) {
        showToast('Please enter your feedback message', 'error');
        return;
    }
    
    if (!currentUser || !currentUser.access_token) {
        showToast('Please login first', 'error');
        showScreen('welcome');
        return;
    }
    
    const submitBtn = document.getElementById('feedback-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: type, message: message })
        });
        
        if (response.ok) {
            showToast('Thank you for your feedback!', 'success');
            document.getElementById('feedback-message').value = '';
            document.getElementById('feedback-type').value = 'bug';
            setTimeout(() => {
                showScreen('main');
            }, 1500);
        } else {
            const errorMsg = await parseApiError(response, 'Failed to submit feedback');
            showToast(sanitizeError(errorMsg, 'Failed to submit feedback. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleUpgradeInterest() {
    if (!currentUser || !currentUser.access_token || !currentUser.email) {
        showToast('Please login first', 'error');
        showScreen('welcome');
        return;
    }
    
    const notes = document.getElementById('upgrade-notes').value.trim();
    
    const submitBtn = document.getElementById('upgrade-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    try {
        const response = await fetch(`${API_BASE}/upgrade/express-interest`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentUser.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: notes || null })
        });
        
        if (response.ok) {
            showToast('Thank you for your interest! We\'ll keep you updated.', 'success');
            document.getElementById('upgrade-notes').value = '';
            setTimeout(() => {
                showScreen('main');
            }, 1500);
        } else {
            const errorMsg = await parseApiError(response, 'Failed to submit interest');
            showToast(sanitizeError(errorMsg, 'Failed to submit interest. Please try again.'), 'error');
        }
    } catch (error) {
        showToast(sanitizeError(error, 'Network error. Please check your connection.'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * Displays a toast notification to the user
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', or 'info'
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.className = 'toast';
    }, 3000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "tabChanged") {
        sendResponse({ received: true });
    }
    return true;
});
