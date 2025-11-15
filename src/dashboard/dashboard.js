const API_BASE = window.location.origin + '/api/v1';

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

let currentUser = null;
let isLoadingDashboard = false;
let isDisplayingContextBoxes = false;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeDashboard();
});

async function initializeDashboard() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showLoginForm();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/contexts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            currentUser = { access_token: token };
            hideLoginForm();
            await loadDashboard();
        } else {
            localStorage.removeItem('access_token');
            showLoginForm();
        }
    } catch (error) {
        localStorage.removeItem('access_token');
        showLoginForm();
    }
}

async function loadDashboard() {
    if (isLoadingDashboard) {
        return;
    }
    
    if (!currentUser || !currentUser.access_token) {
        showError('Not authenticated. Please login.');
        showLoginForm();
        return;
    }
    
    isLoadingDashboard = true;
    
    try {
        const container = document.getElementById('context-boxes');
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
        
        const [contextsResponse, analyticsResponse] = await Promise.all([
            fetch(`${API_BASE}/contexts`, {
                headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
            }),
            fetch(`${API_BASE}/analytics?limit=1000`, {
                headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
            })
        ]);
        
        if (!contextsResponse.ok) {
            if (contextsResponse.status === 401) {
                localStorage.removeItem('access_token');
                showError('Session expired. Please login again.');
                showLoginForm();
                isLoadingDashboard = false;
                return;
            }
            throw new Error(`Failed to load contexts: ${contextsResponse.status}`);
        }
        
        const contexts = await contextsResponse.json();
        displayContextBoxes(contexts);
        
        if (analyticsResponse.ok) {
            const analytics = await analyticsResponse.json();
            displayAnalytics(analytics, contexts);
        }
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        isLoadingDashboard = false;
        
    } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        showError('Failed to load dashboard: ' + errorMsg);
        document.getElementById('loading').style.display = 'none';
        isLoadingDashboard = false;
        
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Session expired')) {
            localStorage.removeItem('access_token');
            setTimeout(() => {
                showLoginForm();
            }, 2000);
        }
    }
}

function displayContextBoxes(contexts) {
    if (isDisplayingContextBoxes) {
        return;
    }
    
    const container = document.getElementById('context-boxes');
    if (!container) {
        return;
    }
    
    isDisplayingContextBoxes = true;
    
    try {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        const defaultBoxes = ['Career', 'Work', 'Health', 'Travel', 'Custom'];
        
        defaultBoxes.forEach(boxName => {
            const context = contexts.find(c => c.box_name === boxName);
            const card = document.createElement('div');
            card.className = 'dashboard-card';
            
            const emoji = getBoxEmoji(boxName);
            const lastUsed = context?.last_used_at ? 
                formatDateTime(context.last_used_at) : 'Never';
            
            const title = document.createElement('h3');
            title.textContent = `${emoji} ${boxName}`;
            
            const stats = document.createElement('div');
            stats.className = 'dashboard-stats';
            
            const versionsText = document.createElement('strong');
            versionsText.textContent = `${context?.versions_count || 0} versions`;
            
            const usesText = document.createTextNode(`${context?.total_uses || 0} total uses`);
            const lastUsedText = document.createTextNode(`Last used: ${lastUsed}`);
            
            stats.appendChild(versionsText);
            stats.appendChild(document.createElement('br'));
            stats.appendChild(usesText);
            stats.appendChild(document.createElement('br'));
            stats.appendChild(lastUsedText);
            
            const button = document.createElement('button');
            button.className = 'btn btn-primary';
            button.style.width = '100%';
            button.style.marginTop = '15px';
            button.textContent = 'View Versions';
            button.addEventListener('click', () => {
                viewVersions(boxName);
            });
            
            card.appendChild(title);
            card.appendChild(stats);
            card.appendChild(button);
            
            container.appendChild(card);
        });
    } finally {
        isDisplayingContextBoxes = false;
    }
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

function displayAnalytics(analytics, contexts) {
    const totalCopies = analytics.reduce((sum, event) => 
        (event.event_type === 'copy' || event.event_type === 'context_copied') ? sum + 1 : sum, 0);
    const totalInserts = analytics.reduce((sum, event) => 
        (event.event_type === 'insert' || event.event_type === 'context_inserted') ? sum + 1 : sum, 0);
    
    const totalVersions = contexts.reduce((sum, context) => sum + (context.versions_count || 0), 0);
    
    const sitesMap = {};
    analytics.forEach(event => {
        const site = event.event_metadata?.site;
        const eventType = event.event_type;
        const isUseEvent = eventType === 'insert' || eventType === 'copy' || 
                          eventType === 'context_inserted' || eventType === 'context_copied';
        
        if (site && isUseEvent) {
            const siteDomain = site.toLowerCase();
            const isLLMSite = LLM_SITES.some(llmSite => siteDomain.includes(llmSite));
            
            if (isLLMSite) {
                sitesMap[site] = (sitesMap[site] || 0) + 1;
            }
        }
    });
    
    const llmApps = Object.keys(sitesMap).length;
    const llmAppsList = Object.entries(sitesMap)
        .sort((a, b) => b[1] - a[1])
        .map(([site, count]) => `${site} (${count})`)
        .join(', ') || 'No LLM apps used yet';
    
    document.getElementById('total-copies').textContent = totalCopies + totalInserts;
    document.getElementById('total-versions').textContent = totalVersions;
    document.getElementById('llm-apps').textContent = llmApps || '0';
    document.getElementById('llm-apps').title = llmAppsList;
    
    displayRecentActivity(analytics.slice(0, 10));
    displayLLMApps(sitesMap);
}

function displayRecentActivity(activities) {
    const container = document.getElementById('recent-activity');
    container.innerHTML = '';
    
    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const time = formatDateTime(activity.created_at);
        const description = getActivityDescription(activity);
        
        item.innerHTML = `
            <strong>${description}</strong><br>
            <span class="activity-time">${time}</span>
        `;
        
        container.appendChild(item);
    });
}

function getActivityDescription(activity) {
    const metadata = activity.event_metadata || activity.metadata || {};
    const eventType = activity.event_type;
    const boxName = metadata.box_name || metadata.box || 'Context';
    const version = metadata.version_number ?? '?';
    
    switch (eventType) {
        case 'copy':
        case 'context_copied':
            return `📋 ${boxName} v${version} copied to clipboard`;
        case 'context_created':
        case 'create_version':
            return `✨ ${boxName} v${version} created`;
        case 'insert':
        case 'context_inserted':
            const site = metadata.site ? ` on ${metadata.site}` : '';
            return `🚀 ${boxName} v${version} inserted${site}`;
        case 'context_used':
            return `📌 ${boxName} v${version} used`;
        default:
            return `${eventType}: ${boxName} v${version}`;
    }
}

function displayLLMApps(sitesMap) {
    const container = document.getElementById('llm-apps-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (Object.keys(sitesMap).length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No LLM apps used yet. Start inserting contexts to track usage!</p>';
        return;
    }
    
    const sortedSites = Object.entries(sitesMap).sort((a, b) => b[1] - a[1]);
    
    sortedSites.forEach(([site, count]) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
        
        const siteName = document.createElement('span');
        siteName.textContent = site;
        siteName.style.fontWeight = '500';
        
        const badge = document.createElement('span');
        badge.textContent = `${count} uses`;
        badge.style.cssText = 'background: #007bff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;';
        
        item.appendChild(siteName);
        item.appendChild(badge);
        container.appendChild(item);
    });
}

async function viewVersions(boxName) {
    try {
        const response = await fetch(`${API_BASE}/contexts/${boxName}/versions`, {
            headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
        });
        
        if (response.ok) {
            const versions = await response.json();
            
            const versionsWithText = await Promise.all(versions.map(async (version) => {
                try {
                    const versionResponse = await fetch(`${API_BASE}/contexts/${boxName}/versions/${version.version_number}`, {
                        headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
                    });
                    
                    if (versionResponse.ok) {
                        const versionData = await versionResponse.json();
                        const decryptResponse = await fetch(`${API_BASE}/contexts/decrypt`, {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${currentUser.access_token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ ciphertext: versionData.ciphertext })
                        });
                        
                        if (decryptResponse.ok) {
                            const decryptData = await decryptResponse.json();
                            return { ...version, text: decryptData.plaintext };
                        }
                    }
                } catch (err) {
                }
                return { ...version, text: 'Unable to load text' };
            }));
            
            showVersionsModal(boxName, versionsWithText);
        } else {
            alert('Failed to load versions');
        }
    } catch (error) {
        alert('Error loading versions: ' + error.message);
    }
}

function showVersionsModal(boxName, versions) {
    const modal = document.createElement('div');
    modal.id = 'versions-modal';
    modal.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h2');
    title.style.margin = '0';
    title.textContent = `${getBoxEmoji(boxName)} ${boxName} Versions`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const versionsList = document.createElement('div');
    versionsList.id = 'versions-list-in-modal';
    
    modalContent.appendChild(header);
    modalContent.appendChild(versionsList);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    if (!versions || versions.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-state';
        emptyMsg.textContent = 'No versions yet';
        versionsList.appendChild(emptyMsg);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        return;
    }
    
    const latestVersionNumber = Math.max(...versions.map(v => v.version_number));
    
    versions.forEach(version => {
        const versionItem = document.createElement('div');
        versionItem.className = 'version-item-card';
        
        const itemHeader = document.createElement('div');
        itemHeader.className = 'version-item-header';
        
        const leftDiv = document.createElement('div');
        const versionStrong = document.createElement('strong');
        versionStrong.className = 'version-number';
        versionStrong.textContent = `v${version.version_number}`;
        leftDiv.appendChild(versionStrong);
        
        if (version.version_number === latestVersionNumber) {
            const latestBadge = document.createElement('span');
            latestBadge.className = 'latest-badge';
            latestBadge.textContent = 'Latest';
            leftDiv.appendChild(latestBadge);
        }
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'version-date';
        dateSpan.textContent = formatDateTime(version.created_at);
        
        itemHeader.appendChild(leftDiv);
        itemHeader.appendChild(dateSpan);
        
        const textContainer = document.createElement('div');
        textContainer.className = 'version-text-container';
        const textPre = document.createElement('pre');
        textPre.className = 'version-text';
        textPre.textContent = version.text || 'Loading...';
        textContainer.appendChild(textPre);
        
        const statsDiv = document.createElement('div');
        statsDiv.className = 'version-stats';
        let lastUsedText = 'Never used';
        if (version.last_used_at) {
            const lastUsedDate = formatDateTime(version.last_used_at);
            if (version.last_llm_used && version.last_llm_used.trim()) {
                lastUsedText = `Last used on ${version.last_llm_used} at ${lastUsedDate}`;
            } else {
                lastUsedText = `Last used at ${lastUsedDate}`;
            }
        }
        statsDiv.textContent = `📊 Used ${version.uses_count} times • ${lastUsedText}`;
        
        versionItem.appendChild(itemHeader);
        versionItem.appendChild(textContainer);
        versionItem.appendChild(statsDiv);
        versionsList.appendChild(versionItem);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function sendFeedback() {
    const subject = encodeURIComponent('RememberMyContext - Feedback');
    const body = encodeURIComponent('Hi,\n\nI wanted to share the following feedback:\n\n');
    window.location.href = `mailto:support@remembermycontext.com?subject=${subject}&body=${body}`;
}

window.upgrade = function() {
    const modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content modal-content-small';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'upgrade-modal-content';
    
    const title = document.createElement('h2');
    title.className = 'upgrade-title';
    title.textContent = 'Pro Plan Features';
    
    const featuresDiv = document.createElement('div');
    featuresDiv.className = 'upgrade-features';
    
    const features = [
        'Unlimited Context Boxes',
        'Advanced Analytics',
        'Team Collaboration',
        'Priority Support',
        'Export/Import Contexts',
        'Custom Integrations'
    ];
    
    features.forEach(feature => {
        const featureItem = document.createElement('div');
        featureItem.className = 'upgrade-feature-item';
        const strong = document.createElement('strong');
        strong.textContent = '✓ ';
        featureItem.appendChild(strong);
        featureItem.appendChild(document.createTextNode(feature));
        featuresDiv.appendChild(featureItem);
    });
    
    const comingSoonDiv = document.createElement('div');
    comingSoonDiv.className = 'upgrade-coming-soon';
    const comingSoonTitle = document.createElement('div');
    comingSoonTitle.className = 'upgrade-coming-soon-title';
    comingSoonTitle.textContent = 'Coming Soon';
    const comingSoonSubtitle = document.createElement('div');
    comingSoonSubtitle.className = 'upgrade-coming-soon-subtitle';
    comingSoonSubtitle.textContent = 'Pricing details will be announced soon';
    comingSoonDiv.appendChild(comingSoonTitle);
    comingSoonDiv.appendChild(comingSoonSubtitle);
    
    const footer = document.createElement('div');
    footer.className = 'upgrade-footer';
    footer.textContent = 'Pro plan features will be available soon';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'upgrade-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(featuresDiv);
    contentDiv.appendChild(comingSoonDiv);
    contentDiv.appendChild(footer);
    contentDiv.appendChild(closeBtn);
    
    modalContent.appendChild(contentDiv);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function logout() {
    localStorage.removeItem('access_token');
    showLoginForm();
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    
    if (!document.getElementById('login-form')) {
        const loginForm = document.createElement('div');
        loginForm.id = 'login-form';
        loginForm.innerHTML = `
            <div style="max-width: 400px; margin: 50px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="text-align: center; margin-bottom: 30px; color: #333;">Login to Dashboard</h2>
                <form id="login-form-element">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #555;">Email:</label>
                        <input type="email" id="login-email" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; color: #555;">Password:</label>
                        <input type="password" id="login-password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">Login</button>
                </form>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="showRegisterForm()" style="background: none; border: none; color: #007bff; cursor: pointer; text-decoration: underline;">Don't have an account? Register</button>
                </div>
                <div id="login-error" style="color: red; margin-top: 10px; text-align: center;"></div>
            </div>
        `;
        document.body.appendChild(loginForm);
        
        // Add event listener
        document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    }
    
    document.getElementById('login-form').style.display = 'block';
}

function hideLoginForm() {
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').style.display = 'none';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            currentUser = { access_token: data.access_token };
            hideLoginForm();
            await loadDashboard();
        } else {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = 'Login failed';
            
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                    errorMessage = errorData.detail.message;
                } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                    errorMessage = errorData.detail.map(e => {
                        if (typeof e === 'string') return e;
                        if (e && typeof e === 'object' && e.msg) return e.msg;
                        return String(e);
                    }).filter(msg => msg).join('; ');
                } else {
                    errorMessage = errorData.detail.message || JSON.stringify(errorData.detail);
                }
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
            
            errorDiv.textContent = errorMessage;
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
    }
}

function showRegisterForm() {
    if (!document.getElementById('register-form')) {
        const registerForm = document.createElement('div');
        registerForm.id = 'register-form';
        registerForm.innerHTML = `
            <div style="max-width: 400px; margin: 50px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="text-align: center; margin-bottom: 30px; color: #333;">Create Account</h2>
                <form id="register-form-element">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #555;">Email:</label>
                        <input type="email" id="register-email" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #555;">Password:</label>
                        <input type="password" id="register-password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; color: #555;">Confirm Password:</label>
                        <input type="password" id="register-confirm-password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">Create Account</button>
                </form>
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="showLoginForm()" style="background: none; border: none; color: #007bff; cursor: pointer; text-decoration: underline;">Already have an account? Login</button>
                </div>
                <div id="register-error" style="color: red; margin-top: 10px; text-align: center;"></div>
            </div>
        `;
        document.body.appendChild(registerForm);
        
        document.getElementById('register-form-element').addEventListener('submit', handleRegister);
    }
    
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorDiv = document.getElementById('register-error');
    
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const loginResponse = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (loginResponse.ok) {
                const data = await loginResponse.json();
                localStorage.setItem('access_token', data.access_token);
                currentUser = { access_token: data.access_token };
                document.getElementById('register-form').style.display = 'none';
                await loadDashboard();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = 'Registration failed';
            
            if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                    errorMessage = errorData.detail;
                } else if (errorData.detail.message && typeof errorData.detail.message === 'string') {
                    errorMessage = errorData.detail.message;
                } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
                    errorMessage = errorData.detail.map(e => {
                        if (typeof e === 'string') return e;
                        if (e && typeof e === 'object' && e.msg) return e.msg;
                        return String(e);
                    }).filter(msg => msg).join('; ');
                } else {
                    errorMessage = errorData.detail.message || JSON.stringify(errorData.detail);
                }
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
            
            errorDiv.textContent = errorMessage;
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
    }
}
