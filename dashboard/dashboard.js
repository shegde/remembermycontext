const API_BASE = 'http://localhost:8000/api/v1';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeDashboard();
});

async function initializeDashboard() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showLoginForm();
        return;
    }
    
    // Verify token is still valid
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
        console.error('Auth check failed:', error);
        localStorage.removeItem('access_token');
        showLoginForm();
    }
}

async function loadDashboard() {
    try {
        const [contextsResponse, analyticsResponse] = await Promise.all([
            fetch(`${API_BASE}/contexts`, {
                headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
            }),
            fetch(`${API_BASE}/analytics`, {
                headers: { 'Authorization': `Bearer ${currentUser.access_token}` }
            })
        ]);
        
        if (!contextsResponse.ok) {
            throw new Error('Failed to load contexts');
        }
        
        const contexts = await contextsResponse.json();
        displayContextBoxes(contexts);
        
        if (analyticsResponse.ok) {
            const analytics = await analyticsResponse.json();
            displayAnalytics(analytics);
        }
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        
    } catch (error) {
        showError('Failed to load dashboard: ' + error.message);
    }
}

function displayContextBoxes(contexts) {
    const container = document.getElementById('context-boxes');
    const defaultBoxes = ['Career', 'Work', 'Health', 'Travel', 'Custom'];
    
    defaultBoxes.forEach(boxName => {
        const context = contexts.find(c => c.box_name === boxName);
        const card = document.createElement('div');
        card.className = 'dashboard-card';
        
        const emoji = getBoxEmoji(boxName);
        const lastUsed = context?.last_used_at ? 
            new Date(context.last_used_at).toLocaleString() : 'Never';
        const lastUpdated = context?.last_used_at ? 
            new Date(context.last_used_at).toLocaleDateString() : 'Never';
        
        card.innerHTML = `
            <h3>${emoji} ${boxName}</h3>
            <div class="dashboard-stats">
                <strong>${context?.versions_count || 0} versions</strong><br>
                ${context?.total_uses || 0} total uses<br>
                Last used: ${lastUsed}<br>
                Last updated: ${lastUpdated}
            </div>
            <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" 
                    onclick="viewVersions('${boxName}')">View Versions</button>
        `;
        
        container.appendChild(card);
    });
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

function displayAnalytics(analytics) {
    const totalCopies = analytics.reduce((sum, event) => 
        event.event_type === 'copy' ? sum + 1 : sum, 0);
    const totalInserts = analytics.reduce((sum, event) => 
        event.event_type === 'insert' ? sum + 1 : sum, 0);
    const totalVersions = analytics.reduce((sum, event) => 
        event.event_type === 'create_version' ? sum + 1 : sum, 0);
    
    // Get unique sites and count uses per site
    const sitesMap = {};
    analytics.forEach(event => {
        const site = event.event_metadata?.site;
        if (site && (event.event_type === 'insert' || event.event_type === 'copy')) {
            sitesMap[site] = (sitesMap[site] || 0) + 1;
        }
    });
    
    const llmApps = Object.keys(sitesMap).length;
    const llmAppsList = Object.entries(sitesMap)
        .sort((a, b) => b[1] - a[1])
        .map(([site, count]) => `${site} (${count})`)
        .join(', ') || 'No sites yet';
    
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
        
        const time = new Date(activity.created_at).toLocaleString();
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
    switch (activity.event_type) {
        case 'copy':
            return `📋 ${metadata.box_name || 'Context'} v${metadata.version_number ?? '?'} copied to clipboard`;
        case 'create_version':
            return `✨ ${metadata.box_name || 'Context'} v${metadata.version_number ?? '?'} created`;
        case 'insert':
            return `🚀 ${metadata.box_name || 'Context'} v${metadata.version_number ?? '?'} inserted into page`;
        default:
            return activity.event_type;
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
            
            // Fetch and decrypt text for each version
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
                    console.error('Failed to fetch version text:', err);
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
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'versions-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow-y: auto; width: 90%;';
    
    const emoji = getBoxEmoji(boxName);
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">${emoji} ${boxName} Versions</h2>
            <button onclick="document.getElementById('versions-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
        </div>
        <div id="versions-list"></div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Display versions
    const versionsList = document.getElementById('versions-list');
    
    if (versions.length === 0) {
        versionsList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No versions yet</p>';
        return;
    }
    
    versions.forEach(version => {
        const versionItem = document.createElement('div');
        versionItem.style.cssText = 'padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;';
        
        const isLatest = version.version_number === Math.max(...versions.map(v => v.version_number));
        
        versionItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 16px;">v${version.version_number} ${isLatest ? '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">Latest</span>' : ''}</strong>
                <span style="color: #666; font-size: 14px;">${new Date(version.created_at).toLocaleString()}</span>
            </div>
            <div style="background: white; padding: 10px; border-radius: 4px; margin: 10px 0; border: 1px solid #ddd; max-height: 150px; overflow-y: auto;">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 14px;">${version.text || 'Loading...'}</pre>
            </div>
            <div style="color: #666; font-size: 14px;">
                📊 Used ${version.uses_count} times
                ${version.last_used_at ? `• Last used: ${new Date(version.last_used_at).toLocaleString()}` : '• Never used'}
            </div>
        `;
        
        versionsList.appendChild(versionItem);
    });
    
    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function sendFeedback() {
    window.open('mailto:support@memor.ai?subject=Feedback', '_blank');
}

function upgrade() {
    alert('Upgrade to Pro - Coming soon!');
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
    
    // Create login form if it doesn't exist
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
            const error = await response.json();
            errorDiv.textContent = error.detail || 'Login failed';
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
        
        // Add event listener
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
            // Auto-login after successful registration
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
            const error = await response.json();
            errorDiv.textContent = error.detail || 'Registration failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
    }
}
