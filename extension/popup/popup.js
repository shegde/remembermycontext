let API_BASE = '';
let currentUser = null;
let currentBox = null;
let contextsCache = {};

const LLM_SITES = [
    'chatgpt.com',
    'claude.ai',
    'anthropic.com',
    'openai.com',
    'bard.google.com',
    'gemini.google.com',
    'perplexity.ai',
    'poe.com',
    'character.ai',
    'you.com',
    'phind.com',
    'copilot.microsoft.com',
    'bing.com'
];

function getLLMName(hostname) {
    if (!hostname) return null;
    const hostnameLower = hostname.toLowerCase();
    for (const llmSite of LLM_SITES) {
        if (hostnameLower.includes(llmSite)) {
            return llmSite;
        }
    }
    return null;
}

// Helper function to handle API calls with automatic logout on 401
async function apiCall(url, options = {}) {
    const response = await fetch(url, options);
    
    // If unauthorized, logout and redirect to login
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

async function initializeConfig() {
    const config = await getConfig();
    API_BASE = config.apiBaseUrl;
    if (config.calendlyLink) {
        const calendlyLink = document.getElementById('feedback-calendly-link');
        if (calendlyLink) {
            calendlyLink.href = config.calendlyLink;
        }
    }
}

async function initializeApp() {
    const user = await chrome.storage.local.get(['user']);
    if (user.user && user.user.access_token) {
        // Validate token by making a test request
        try {
            const testResponse = await fetch(`${API_BASE}/contexts`, {
                headers: { 'Authorization': `Bearer ${user.user.access_token}` }
            });
            
            if (testResponse.ok || testResponse.status === 404) {
                // Token is valid (404 is ok, means no contexts yet)
                currentUser = user.user;
                const onboardingStatus = await checkOnboardingStatus();
                if (!onboardingStatus || !onboardingStatus.completed) {
                    showScreen('onboarding-1');
                } else {
                    showScreen('main');
                    await loadContexts();
                }
            } else if (testResponse.status === 401 || testResponse.status === 403) {
                // Token expired or invalid
                await handleLogout();
                showScreen('welcome');
            } else {
                // Other error, try to continue but might need to login
                currentUser = user.user;
                showScreen('main');
                await loadContexts();
            }
        } catch (error) {
            // Network error or other issue - clear and show welcome
            console.error('Error validating token:', error);
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
        console.warn(`Failed to add event listener to ${id}:`, error);
    }
}

function setupEventListeners() {
    safeAddEventListener('create-account-btn', 'click', () => showScreen('signup'));
    safeAddEventListener('login-btn', 'click', () => showScreen('login'));
    safeAddEventListener('signup-login-link', 'click', () => showScreen('login'));
    safeAddEventListener('login-signup-link', 'click', () => showScreen('signup'));
    
    safeAddEventListener('signup-submit', 'click', handleSignup);
    safeAddEventListener('login-submit', 'click', handleLogin);
    
    safeAddEventListener('dashboard-btn', 'click', () => {
        const dashboardUrl = API_BASE.replace('/api/v1', '/dashboard');
        chrome.tabs.create({ url: dashboardUrl });
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
        showScreen('forgot-password');
    });
    
    safeAddEventListener('forgot-password-back-btn', 'click', () => {
        showScreen('login');
    });
    
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
    safeAddEventListener('settings-forgot-password-btn', 'click', () => showScreen('forgot-password'));
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
    } else {
        console.warn(`Screen not found: ${screenName}-screen`);
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
            
            // Check if email verification is required
            if (data.email_verification_required) {
                showToast('Account created! Please check your email to verify your account.', 'success');
                showScreen('login');
                document.getElementById('login-email').value = email;
            } else {
                // Try to login if verification not required
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            const errorMsg = await parseApiError(response, 'Login failed');
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            // Token expired or invalid - redirect to login
            await handleLogout();
            showToast('Session expired. Please login again.', 'error');
        }
    } catch (error) {
        console.error('Error loading contexts:', error);
        // On error, check if it's an auth issue
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
    }
}

function displayVersions(versions) {
    const container = document.getElementById('versions-list');
    container.innerHTML = '';
    
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
            
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentSite = tabs[0] ? new URL(tabs[0].url).hostname : 'unknown';
            const llmName = getLLMName(currentSite);
            
            await chrome.runtime.sendMessage({
                action: "insertText",
                text: decryptedText
            });
            showToast('Inserted into page!');
            
            await fetch(`${API_BASE}/contexts/${boxName}/versions/${versionNumber}/mark_used`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ site: currentSite, llm_name: llmName })
            });
            
            // Only log insert event if on an allowed LLM site
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
        // Track onboarding step completion
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
        // Track onboarding skipped
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
    const email = document.getElementById('forgot-password-email').value.trim();
    
    if (!validateEmail(email)) {
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
    }
}

async function handleResendVerification() {
    const email = currentUser?.email || document.getElementById('login-email').value.trim();
    
    if (!email) {
        showToast('Please enter your email', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            showToast('Verification email sent! Check your inbox.', 'success');
        } else {
            const errorMsg = await parseApiError(response, 'Failed to send verification email');
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
    }
}

async function handleSubmitFeedback() {
    const type = document.getElementById('feedback-type').value;
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
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
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

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
