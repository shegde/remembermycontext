const API_BASE = 'http://localhost:8000/api/v1';

let currentUser = null;
let currentBox = null;
let contextsCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    const user = await chrome.storage.local.get(['user']);
    if (user.user && user.user.access_token) {
        currentUser = user.user;
        showScreen('main');
        await loadContexts();
    } else {
        showScreen('welcome');
    }
}

function setupEventListeners() {
    document.getElementById('create-account-btn').addEventListener('click', () => showScreen('signup'));
    document.getElementById('login-btn').addEventListener('click', () => showScreen('login'));
    document.getElementById('signup-login-link').addEventListener('click', () => showScreen('login'));
    document.getElementById('login-signup-link').addEventListener('click', () => showScreen('signup'));
    
    document.getElementById('signup-submit').addEventListener('click', handleSignup);
    document.getElementById('login-submit').addEventListener('click', handleLogin);
    
    document.getElementById('dashboard-btn').addEventListener('click', () => {
        const dashboardUrl = API_BASE.replace('/api/v1', '/dashboard');
        chrome.tabs.create({ url: dashboardUrl });
    });
    
    document.getElementById('logout-link').addEventListener('click', handleLogout);
    
    document.querySelectorAll('.context-box').forEach(box => {
        box.addEventListener('click', (e) => {
            currentBox = e.currentTarget.dataset.box;
            showVersions();
        });
    });
    
    document.getElementById('versions-back-btn').addEventListener('click', () => showScreen('main'));
    document.getElementById('edit-latest-btn').addEventListener('click', () => showEdit());
    document.getElementById('edit-cancel-btn').addEventListener('click', () => showVersions());
    document.getElementById('edit-save-btn').addEventListener('click', handleSave);
    document.getElementById('upgrade-link').addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('upgrade');
    });
    document.getElementById('upgrade-back-btn').addEventListener('click', () => showScreen('main'));
    
    document.getElementById('feedback-link').addEventListener('click', (e) => {
        e.preventDefault();
        handleSendFeedback();
    });
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenName + '-screen').classList.add('active');
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (password !== confirm) {
        showToast('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            showToast('Account created! Please login.');
            showScreen('login');
            document.getElementById('login-email').value = email;
        } else {
            let errorMsg = 'Registration failed';
            
            try {
                const text = await response.text();
                let errorData = {};
                
                if (text) {
                    try {
                        errorData = JSON.parse(text);
                    } catch (e) {
                        errorMsg = text || `Registration failed (HTTP ${response.status})`;
                        showToast(errorMsg);
                        return;
                    }
                }
                
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMsg = errorData.detail;
                    } else if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                        errorMsg = errorData.detail.message;
                    } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                        errorMsg = errorData.detail.map(e => {
                            if (typeof e === 'string') return e;
                            if (e && typeof e === 'object') {
                                const field = e.loc && Array.isArray(e.loc) && e.loc.length > 1 ? e.loc[e.loc.length - 1] : 'field';
                                const message = e.msg || e.message || 'Validation error';
                                return `${field}: ${message}`;
                            }
                            return String(e);
                        }).filter(msg => msg).join('; ');
                    } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                        errorMsg = errorData.detail.message || JSON.stringify(errorData.detail);
                    } else {
                        errorMsg = String(errorData.detail);
                    }
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                } else if (text && !errorData.detail) {
                    errorMsg = text;
                }
            } catch (parseError) {
                errorMsg = `Registration failed (HTTP ${response.status})`;
            }
            
            showToast(errorMsg);
            console.error('Registration error:', response.status, errorMsg);
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`);
        console.error('Registration network error:', error);
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
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
            showScreen('main');
            await loadContexts();
            showToast('Login successful!');
        } else {
            let errorMsg = 'Login failed';
            
            try {
                const text = await response.text();
                let errorData = {};
                
                if (text) {
                    try {
                        errorData = JSON.parse(text);
                    } catch (e) {
                        errorMsg = text || `Login failed (HTTP ${response.status})`;
                        showToast(errorMsg);
                        return;
                    }
                }
                
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMsg = errorData.detail;
                    } else if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                        errorMsg = errorData.detail.message;
                    } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                        errorMsg = errorData.detail.map(e => {
                            if (typeof e === 'string') return e;
                            if (e && typeof e === 'object') {
                                const field = e.loc && Array.isArray(e.loc) && e.loc.length > 1 ? e.loc[e.loc.length - 1] : 'field';
                                const message = e.msg || e.message || 'Validation error';
                                return `${field}: ${message}`;
                            }
                            return String(e);
                        }).filter(msg => msg).join('; ');
                    } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                        errorMsg = errorData.detail.message || JSON.stringify(errorData.detail);
                    } else {
                        errorMsg = String(errorData.detail);
                    }
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                } else if (text && !errorData.detail) {
                    errorMsg = text;
                }
            } catch (parseError) {
                errorMsg = `Login failed (HTTP ${response.status})`;
            }
            
            showToast(errorMsg);
            console.error('Login error:', response.status, errorMsg);
        }
    } catch (error) {
        showToast(`Network error: ${error.message}. Is backend running on localhost:8000?`);
        console.error('Login network error:', error);
    }
}

async function handleLogout() {
    await chrome.storage.local.remove(['user']);
    currentUser = null;
    contextsCache = {};
    showScreen('welcome');
}

async function loadContexts() {
    if (!currentUser) return;
    
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
        }
    } catch (error) {
        console.error('Failed to load contexts:', error);
    }
}

function updateContextBoxes() {
    const boxes = ['Career', 'Work', 'Health', 'Travel', 'Custom'];
    boxes.forEach(boxName => {
        const boxElement = document.querySelector(`[data-box="${boxName}"]`);
        const context = contextsCache[boxName];
        
        if (context) {
            const lastUsed = context.last_used_at ? 
                new Date(context.last_used_at).toLocaleString() : 'Never used';
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
        console.error('Failed to load versions:', error);
    }
}

function displayVersions(versions) {
    const container = document.getElementById('versions-list');
    container.innerHTML = '';
    
    versions.forEach(version => {
        const versionElement = document.createElement('div');
        versionElement.className = 'version-item';
        versionElement.innerHTML = `
            <div class="version-header">
                <div>
                    <strong>v${version.version_number}</strong>
                    ${version.version_number === Math.max(...versions.map(v => v.version_number)) ? '(Latest)' : ''}
                    <div style="font-size: 11px; color: #666;">${new Date(version.created_at).toLocaleString()}</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-success copy-btn" style="padding: 5px 10px; font-size: 12px;" 
                            data-box="${currentBox}" data-version="${version.version_number}">Copy</button>
                    <button class="btn btn-primary insert-btn" style="padding: 5px 10px; font-size: 12px;" 
                            data-box="${currentBox}" data-version="${version.version_number}">Insert</button>
                </div>
            </div>
            <div class="usage-stats">
                📊 Used ${version.uses_count} times • Last: ${version.last_used_at ? new Date(version.last_used_at).toLocaleString() : 'Never'}
            </div>
        `;
        container.appendChild(versionElement);
    });
    
    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const box = e.target.dataset.box;
            const version = parseInt(e.target.dataset.version);
            copyVersion(box, version);
        });
    });
    
    container.querySelectorAll('.insert-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const box = e.target.dataset.box;
            const version = parseInt(e.target.dataset.version);
            insertVersion(box, version);
        });
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
            
            await fetch(`${API_BASE}/analytics`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    event_type: 'copy',
                    metadata: { box_name: boxName, version_number: versionNumber }
                })
            });
        }
    } catch (error) {
        showToast('Failed to copy');
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
            
            // Get current tab URL
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentSite = tabs[0] ? new URL(tabs[0].url).hostname : 'unknown';
            
            // Send message to background script to insert text
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
                body: JSON.stringify({ site: currentSite })
            });
            
            await fetch(`${API_BASE}/analytics`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentUser.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    event_type: 'insert',
                    metadata: { box_name: boxName, version_number: versionNumber, site: currentSite }
                })
            });
        }
    } catch (error) {
        showToast('Failed to insert');
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
    
    // Fetch and pre-fill latest version text
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
            console.error('Failed to load latest version:', error);
        }
    } else {
        document.getElementById('context-text').value = '';
    }
    
    showScreen('edit');
}

async function handleSave() {
    const text = document.getElementById('context-text').value;
    if (!text.trim()) {
        showToast('Please enter some context');
        return;
    }
    
    if (!currentUser || !currentUser.access_token) {
        showToast('Please login first');
        showScreen('welcome');
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
            let errorMsg = 'Failed to save';
            
            try {
                const text = await response.text();
                let errorData = {};
                
                if (text) {
                    try {
                        errorData = JSON.parse(text);
                    } catch (e) {
                        errorMsg = text || `Failed to save (HTTP ${response.status})`;
                        showToast(errorMsg);
                        return;
                    }
                }
                
                if (errorData.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMsg = errorData.detail;
                    } else if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                        errorMsg = errorData.detail.message;
                    } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                        errorMsg = errorData.detail.map(e => {
                            if (typeof e === 'string') return e;
                            if (e && typeof e === 'object') {
                                const field = e.loc && Array.isArray(e.loc) && e.loc.length > 1 ? e.loc[e.loc.length - 1] : 'field';
                                const message = e.msg || e.message || 'Validation error';
                                return `${field}: ${message}`;
                            }
                            return String(e);
                        }).filter(msg => msg).join('; ');
                    } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
                        errorMsg = errorData.detail.message || JSON.stringify(errorData.detail);
                    } else {
                        errorMsg = String(errorData.detail);
                    }
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                } else if (text && !errorData.detail) {
                    errorMsg = text;
                } else if (response.statusText) {
                    errorMsg = response.statusText;
                }
            } catch (parseError) {
                errorMsg = `Failed to save (HTTP ${response.status})`;
            }
            
            showToast(errorMsg);
            console.error('Save failed:', response.status, errorMsg);
        }
    } catch (error) {
        console.error('Network error:', error);
        showToast('Network error: ' + error.message);
    }
}

function handleSendFeedback() {
    const subject = encodeURIComponent('RememberMyContext - Feedback');
    const body = encodeURIComponent('Hi,\n\nI wanted to share the following feedback:\n\n');
    window.location.href = `mailto:support@remembermycontext.com?subject=${subject}&body=${body}`;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
