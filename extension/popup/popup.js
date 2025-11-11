let API_BASE = '';
let currentUser = null;
let currentBox = null;
let contextsCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    await initializeConfig();
    await initializeApp();
    setupEventListeners();
});

async function initializeConfig() {
    const config = await getConfig();
    API_BASE = config.apiBaseUrl;
}

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
            showToast('Account created! Please login.');
            showScreen('login');
            document.getElementById('login-email').value = email;
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
            showScreen('main');
            await loadContexts();
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
        dateDiv.textContent = new Date(version.created_at).toLocaleString();
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
        const lastUsed = version.last_used_at 
            ? new Date(version.last_used_at).toLocaleString() 
            : 'Never';
        usageStats.textContent = `📊 Used ${version.uses_count} times • Last: ${lastUsed}`;
        
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

function handleSendFeedback() {
    const subject = encodeURIComponent('RememberMyContext - Feedback');
    const body = encodeURIComponent('Hi,\n\nI wanted to share the following feedback:\n\n');
    window.location.href = `mailto:support@remembermycontext.com?subject=${subject}&body=${body}`;
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
