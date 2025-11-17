// Admin Panel JavaScript
const API_BASE = window.location.origin + '/api/v1';
let adminToken = localStorage.getItem('admin_token');
let currentTimeRange = '7d';

// Handle time range change
function handleTimeRangeChange(pageId) {
    const select = document.getElementById(`${pageId}-time-range`);
    if (select) {
        currentTimeRange = select.value;
        if (pageId === 'overview') {
            loadOverviewData();
        } else if (pageId === 'acquisition') {
            loadAcquisitionData();
        } else if (pageId === 'engagement') {
            loadEngagementData();
        } else if (pageId === 'features') {
            loadFeaturesData();
        } else if (pageId === 'llm') {
            loadLLMData();
        }
        // Add handlers for other pages as needed
    }
}

// Check if logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!adminToken) {
        showLoginPage();
    } else {
        showDashboard();
    }
});

function showLoginPage() {
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px;">
                <h1 style="text-align: center; margin-bottom: 30px; color: #2c3e50;">memor.ai Admin</h1>
                <form id="login-form" onsubmit="handleLogin(event)">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; color: #34495e; font-weight: 500;">Username</label>
                        <input type="text" id="username" required style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 5px; color: #34495e; font-weight: 500;">Password</label>
                        <input type="password" id="password" required style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <button type="submit" style="width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer;">
                        Login
                    </button>
                    <div id="login-error" style="color: #e74c3c; margin-top: 15px; text-align: center; display: none;"></div>
                </form>
            </div>
        </div>
    `;
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });

        if (response.ok) {
            const data = await response.json();
            adminToken = data.access_token;
            localStorage.setItem('admin_token', adminToken);
            location.reload();
        } else {
            errorDiv.textContent = 'Invalid credentials';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.style.display = 'block';
    }
}

function showDashboard() {
    // Dashboard is already loaded from HTML
    // Just load overview data initially
    loadOverviewData();
}

function logout() {
    localStorage.removeItem('admin_token');
    location.reload();
}

// Page navigation
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    navItems.forEach(item => {
        if (item.onclick && item.onclick.toString().includes(pageId)) {
            item.classList.add('active');
        }
    });
    
    window.scrollTo(0, 0);
    
    // Load data for the selected page
    loadPageData(pageId);
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'overview':
            loadOverviewData();
            break;
        case 'acquisition':
            loadAcquisitionData();
            break;
        case 'engagement':
            loadEngagementData();
            break;
        case 'features':
            loadFeaturesData();
            break;
        case 'llm':
            loadLLMData();
            break;
        case 'performance':
            loadPerformanceData();
            break;
        case 'dbview':
            loadDBViewData();
            break;
    }
}

// API fetch helper
async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {'Authorization': `Bearer ${adminToken}`}
    });
    if (!response.ok) {
        if (response.status === 401) {
            logout();
        }
        throw new Error('API request failed');
    }
    return response.json();
}

// Format numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Update KPI card
function updateKPI(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = typeof value === 'number' ? formatNumber(value) : value;
    }
}

// Load functions are defined below after chart functions

// Load Features Data
async function loadFeaturesData() {
    try {
        const [metrics, adoption, boxesPerUser, versionDist, boxRatio, powerUserStats, adoptionTimeline] = await Promise.all([
            fetchAPI(`/admin/analytics/features/metrics?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/features/adoption-breakdown?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/features/boxes-per-user`),
            fetchAPI(`/admin/analytics/features/version-distribution`),
            fetchAPI(`/admin/analytics/features/box-ratio`),
            fetchAPI(`/admin/analytics/features/power-user-stats?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/features/adoption-timeline?time_range=${currentTimeRange}`)
        ]);

        // Update KPIs
        const boxUtilEl = document.getElementById('features-box-utilization');
        if (boxUtilEl) {
            boxUtilEl.textContent = `${metrics.context_box_utilization_percent}%`;
        }
        
        updateKPI('features-avg-boxes', metrics.avg_active_boxes_per_user);
        updateKPI('features-multi-version', metrics.multi_version_users);
        updateKPI('features-dashboard-visitors', metrics.dashboard_visitors);
        
        // Update KPI descriptions
        const multiVersionPercent = document.getElementById('features-multi-version-percent');
        if (multiVersionPercent) {
            multiVersionPercent.textContent = `${metrics.multi_version_percent}% of active users`;
        }
        
        const dashboardPercent = document.getElementById('features-dashboard-visitors-percent');
        if (dashboardPercent) {
            dashboardPercent.textContent = `${metrics.dashboard_visitors_percent}% of users`;
        }
        
        // Update adoption table
        if (adoption && adoption.features) {
            const tableBody = document.getElementById('features-adoption-table-body');
            if (tableBody) {
                tableBody.innerHTML = adoption.features.map(feature => {
                    const trend = feature.trend_percent > 0 ? `+${feature.trend_percent}%` : feature.trend_percent < 0 ? `${feature.trend_percent}%` : 'Stable';
                    const trendClass = feature.trend_percent > 0 ? 'up' : feature.trend_percent < 0 ? 'down' : 'stable';
                    return `
                        <tr>
                            <td>${feature.name}</td>
                            <td class="metric-value">${formatNumber(feature.unique_users)}</td>
                            <td>${feature.adoption_rate}%</td>
                            <td>${feature.avg_usage}</td>
                            <td><span class="trend-badge ${trendClass}">${trend}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Update box ratio stats
        if (boxRatio) {
            const boxRatioContainer = document.getElementById('box-ratio-stats');
            if (boxRatioContainer) {
                boxRatioContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">Total Context Boxes Created</span>
                        <span class="metric-item-value">${formatNumber(boxRatio.total_boxes)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Populated (with content)</span>
                        <span class="metric-item-value">${formatNumber(boxRatio.populated_boxes)} (${boxRatio.populated_percent}%)</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Empty (never used)</span>
                        <span class="metric-item-value">${formatNumber(boxRatio.empty_boxes)} (${boxRatio.empty_percent}%)</span>
                    </div>
                `;
            }
        }
        
        // Update power user stats
        if (powerUserStats) {
            const powerUserContainer = document.getElementById('power-user-stats');
            if (powerUserContainer) {
                powerUserContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">Users with 5+ Versions</span>
                        <span class="metric-item-value">${formatNumber(powerUserStats.users_5plus_versions)} (${powerUserStats.users_5plus_versions_percent}%)</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Users with All 5 Boxes</span>
                        <span class="metric-item-value">${formatNumber(powerUserStats.users_all_5_boxes)} (${powerUserStats.users_all_5_boxes_percent}%)</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Daily Dashboard Visitors</span>
                        <span class="metric-item-value">${formatNumber(powerUserStats.daily_dashboard_visitors)} (${powerUserStats.daily_dashboard_visitors_percent}%)</span>
                    </div>
                `;
            }
        }

        // Update charts
        await updateFeaturesCharts(boxesPerUser, versionDist, adoption, adoptionTimeline);

        console.log('Features data loaded:', {metrics, adoption, boxesPerUser, versionDist, boxRatio, powerUserStats, adoptionTimeline});
    } catch (error) {
        console.error('Error loading features data:', error);
    }
}


// Load Monetization Data
async function loadMonetizationData() {
    try {
        const [metrics, segments] = await Promise.all([
            fetchAPI(`/admin/analytics/monetization/metrics?time_range=30d`),
            fetchAPI(`/admin/analytics/monetization/user-segments?time_range=${currentTimeRange}`)
        ]);

        console.log('Monetization data loaded:', {metrics, segments});
    } catch (error) {
        console.error('Error loading monetization data:', error);
    }
}

// Load Performance Data
async function loadPerformanceData() {
    try {
        const metrics = await fetchAPI(`/admin/analytics/performance/metrics`);
        console.log('Performance data loaded:', metrics);
    } catch (error) {
        console.error('Error loading performance data:', error);
    }
}

// Load Retention Data
async function loadRetentionData() {
    try {
        const metrics = await fetchAPI(`/admin/analytics/retention/metrics`);
        console.log('Retention data loaded:', metrics);
    } catch (error) {
        console.error('Error loading retention data:', error);
    }
}

// Load Content Data
async function loadContentData() {
    try {
        const [metrics, boxPerformance] = await Promise.all([
            fetchAPI(`/admin/analytics/content/metrics?time_range=30d`),
            fetchAPI(`/admin/analytics/content/box-performance`)
        ]);

        console.log('Content data loaded:', {metrics, boxPerformance});
    } catch (error) {
        console.error('Error loading content data:', error);
    }
}

// Chart instances storage
const chartInstances = {};

// Destroy existing chart if it exists
function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

// Create line chart
function createLineChart(canvasId, data, options = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.warn(`Canvas element not found: ${canvasId}`);
        return;
    }
    
    // Ensure Chart is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            ...options
        }
    });
}

// Create bar chart
function createBarChart(canvasId, data, options = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.warn(`Canvas element not found: ${canvasId}`);
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return value + ' (' + percentage + '%)';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            ...options
        },
        plugins: [{
            id: 'percentageLabels',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        if (value > 0 && total > 0) {
                            const percentage = ((value / total) * 100).toFixed(1);
                            const position = element.tooltipPosition();
                            ctx.save();
                            ctx.fillStyle = '#2c3e50';
                            ctx.font = 'bold 11px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(percentage + '%', position.x, position.y - 5);
                            ctx.restore();
                        }
                    });
                });
            }
        }]
    });
}

// Create pie/doughnut chart
function createPieChart(canvasId, data, options = {}) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.warn(`Canvas element not found: ${canvasId}`);
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }
    
    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                label += context.parsed + ' (' + percentage + '%)';
                            }
                            return label;
                        }
                    }
                }
            },
            ...options
        },
        plugins: [{
            id: 'percentageLabels',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        if (value > 0 && total > 0) {
                            const percentage = ((value / total) * 100).toFixed(1);
                            const position = element.tooltipPosition();
                            ctx.save();
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 12px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(percentage + '%', position.x, position.y);
                            ctx.restore();
                        }
                    });
                });
            }
        }]
    });
}

// Wait for Chart.js to be available
function waitForChartJS(callback, maxAttempts = 10) {
    if (typeof Chart !== 'undefined') {
        callback();
    } else if (maxAttempts > 0) {
        setTimeout(() => waitForChartJS(callback, maxAttempts - 1), 100);
    } else {
        console.error('Chart.js failed to load after multiple attempts');
    }
}

// Update Overview charts
async function updateOverviewCharts(timeline, boxDist, llmDist) {
    waitForChartJS(() => {
        // Growth Timeline Chart
        if (timeline && timeline.days) {
        createLineChart('growth-timeline-chart', {
            labels: timeline.days.map(d => d.date),
            datasets: [
                {
                    label: 'Daily Active Users',
                    data: timeline.days.map(d => d.active_users || 0),
                    borderColor: 'rgb(52, 152, 219)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'New Signups',
                    data: timeline.days.map(d => d.new_signups || 0),
                    borderColor: 'rgb(46, 204, 113)',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Context Copies',
                    data: timeline.days.map(d => d.context_copies || 0),
                    borderColor: 'rgb(155, 89, 182)',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    tension: 0.4
                }
            ]
        });
        }
        
        // Box Distribution Chart
        if (boxDist && boxDist.boxes) {
        const boxes = Object.entries(boxDist.boxes);
        createPieChart('box-distribution-chart', {
            labels: boxes.map(([name]) => name),
            datasets: [{
                data: boxes.map(([, data]) => data.count || 0),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(231, 76, 60, 0.8)',
                    'rgba(155, 89, 182, 0.8)'
                ]
            }]
        });
        }
        
        // LLM Distribution Chart
        if (llmDist && llmDist.distribution) {
        const dist = Object.entries(llmDist.distribution).filter(([name]) => name.toLowerCase() !== 'other');
        if (dist.length > 0) {
            createBarChart('llm-distribution-chart', {
                labels: dist.map(([name]) => name),
                datasets: [{
                    label: 'Usage',
                    data: dist.map(([, data]) => data.count || 0),
                    backgroundColor: 'rgba(52, 152, 219, 0.8)'
                }]
            });
        }
        }
    });
}

// Update Acquisition charts
async function updateAcquisitionCharts(timeline, funnel, patterns) {
    waitForChartJS(() => {
        // Acquisition Timeline
        if (timeline && timeline.dates) {
            createLineChart('acquisition-timeline-chart', {
                labels: timeline.dates,
                datasets: [
                    {
                        label: 'Cumulative Users',
                        data: timeline.cumulative_users || [],
                        borderColor: 'rgb(52, 152, 219)',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'New Signups',
                        data: timeline.new_signups || [],
                        borderColor: 'rgb(46, 204, 113)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        tension: 0.4
                    }
                ]
            });
        }
        
        // Funnel Chart
        if (funnel && funnel.funnel) {
            createBarChart('funnel-chart', {
                labels: funnel.funnel.map(s => s.stage),
                datasets: [{
                    label: 'Users',
                    data: funnel.funnel.map(s => s.count || 0),
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.8)',
                        'rgba(46, 204, 113, 0.8)',
                        'rgba(241, 196, 15, 0.8)',
                        'rgba(155, 89, 182, 0.8)'
                    ]
                }]
            });
        }
    
        // Signup Patterns
        if (patterns) {
            if (patterns.by_day_of_week) {
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const dayData = days.map(day => patterns.by_day_of_week[day] || 0);
                
                createBarChart('signup-day-pattern-chart', {
                    labels: dayLabels,
                    datasets: [{
                        label: 'Signups',
                        data: dayData,
                        backgroundColor: 'rgba(52, 152, 219, 0.8)'
                    }]
                });
            }
            
            if (patterns.by_hour) {
                const hours = Array.from({length: 24}, (_, i) => i.toString());
                const hourLabels = hours.map(h => `${h}:00`);
                const hourData = hours.map(h => patterns.by_hour[h] || 0);
                
                createBarChart('signup-hour-pattern-chart', {
                    labels: hourLabels,
                    datasets: [{
                        label: 'Signups',
                        data: hourData,
                        backgroundColor: 'rgba(46, 204, 113, 0.8)'
                    }]
                });
            }
        }
    });
}

// Update Engagement charts
async function updateEngagementCharts(copyActivity, boxUsage, onboardingFunnel) {
    waitForChartJS(() => {
        // Copy Activity Chart
        if (copyActivity) {
            const labels = copyActivity.days ? copyActivity.days.map(d => d.date) : copyActivity.dates || [];
            const copies = copyActivity.days ? copyActivity.days.map(d => d.copies || 0) : copyActivity.context_copies || [];
            const movingAvg = copyActivity.days ? copyActivity.days.map(d => d.moving_avg || 0) : copyActivity.moving_average_7d || [];
            
            if (labels.length > 0) {
                createLineChart('copy-activity-chart', {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Daily Copies',
                            data: copies,
                            borderColor: 'rgb(52, 152, 219)',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: '7-Day Moving Average',
                            data: movingAvg,
                            borderColor: 'rgb(46, 204, 113)',
                            backgroundColor: 'rgba(46, 204, 113, 0.1)',
                            borderDash: [5, 5],
                            tension: 0.4
                        }
                    ]
                });
            }
        }
        
        // Box Utilization Chart (from boxUsage)
        if (boxUsage) {
            const boxes = Object.entries(boxUsage).sort((a, b) => b[1].copies - a[1].copies);
            if (boxes.length > 0) {
                createBarChart('box-utilization-chart', {
                    labels: boxes.map(([name]) => name.charAt(0).toUpperCase() + name.slice(1)),
                    datasets: [{
                        label: 'Copies',
                        data: boxes.map(([, data]) => data.copies || 0),
                        backgroundColor: [
                            'rgba(52, 152, 219, 0.8)',
                            'rgba(46, 204, 113, 0.8)',
                            'rgba(241, 196, 15, 0.8)',
                            'rgba(231, 76, 60, 0.8)',
                            'rgba(155, 89, 182, 0.8)'
                        ]
                    }]
                });
            }
        }
        
    });
}

// Update LLM charts
async function updateLLMCharts(distribution, platforms, usageTrends, diversity) {
    waitForChartJS(() => {
        // LLM Platform Distribution (pie chart)
        if (distribution) {
            const labels = [];
            const data = [];
            const colors = {
                'chatgpt': 'rgba(52, 152, 219, 0.8)',
                'claude': 'rgba(155, 89, 182, 0.8)',
                'gemini': 'rgba(241, 196, 15, 0.8)',
                'perplexity': 'rgba(46, 204, 113, 0.8)',
                'others': 'rgba(231, 76, 60, 0.8)'
            };
            
            // Filter out "others" and build chart data
            for (const [llm, data_obj] of Object.entries(distribution)) {
                if (llm !== 'others') {  // Exclude "others" as per user request
                    labels.push(llm.charAt(0).toUpperCase() + llm.slice(1));
                    data.push(data_obj.percentage || 0);
                }
            }
            
            if (labels.length > 0) {
                createPieChart('llm-platform-chart', {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: Object.values(colors).slice(0, labels.length)
                    }]
                });
            }
        }
        
        // LLM Usage Trends (stacked area chart)
        if (usageTrends && usageTrends.dates) {
            createLineChart('llm-usage-trends-chart', {
                labels: usageTrends.dates,
                datasets: [
                    {
                        label: 'ChatGPT',
                        data: usageTrends.chatgpt || [],
                        borderColor: 'rgb(52, 152, 219)',
                        backgroundColor: 'rgba(52, 152, 219, 0.3)',
                        fill: true,
                        tension: 0.4,
                        stack: 'stack1'
                    },
                    {
                        label: 'Claude',
                        data: usageTrends.claude || [],
                        borderColor: 'rgb(155, 89, 182)',
                        backgroundColor: 'rgba(155, 89, 182, 0.3)',
                        fill: true,
                        tension: 0.4,
                        stack: 'stack1'
                    },
                    {
                        label: 'Gemini',
                        data: usageTrends.gemini || [],
                        borderColor: 'rgb(241, 196, 15)',
                        backgroundColor: 'rgba(241, 196, 15, 0.3)',
                        fill: true,
                        tension: 0.4,
                        stack: 'stack1'
                    },
                    {
                        label: 'Perplexity',
                        data: usageTrends.perplexity || [],
                        borderColor: 'rgb(46, 204, 113)',
                        backgroundColor: 'rgba(46, 204, 113, 0.3)',
                        fill: true,
                        tension: 0.4,
                        stack: 'stack1'
                    },
                    {
                        label: 'Others',
                        data: usageTrends.others || [],
                        borderColor: 'rgb(231, 76, 60)',
                        backgroundColor: 'rgba(231, 76, 60, 0.3)',
                        fill: true,
                        tension: 0.4,
                        stack: 'stack1'
                    }
                ]
            }, {
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true
                    }
                }
            });
        }
        
        // User LLM Diversity Chart
        if (diversity && diversity.distribution) {
            createBarChart('llm-diversity-chart', {
                labels: diversity.distribution.map(d => `${d.llms} LLM${d.llms === '1' ? '' : 's'}`),
                datasets: [{
                    label: 'Users',
                    data: diversity.distribution.map(d => d.users),
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.8)',
                        'rgba(46, 204, 113, 0.8)',
                        'rgba(241, 196, 15, 0.8)',
                        'rgba(155, 89, 182, 0.8)'
                    ]
                }]
            });
        }
    });
}

// Update Features charts
async function updateFeaturesCharts(boxesPerUser, versionDist, adoption, adoptionTimeline) {
    waitForChartJS(() => {
        // Boxes Per User Chart
        if (boxesPerUser && boxesPerUser.distribution) {
            createBarChart('boxes-per-user-chart', {
                labels: boxesPerUser.distribution.map(d => `${d.boxes} ${d.boxes === 1 ? 'box' : 'boxes'}`),
                datasets: [{
                    label: 'Users',
                    data: boxesPerUser.distribution.map(d => d.users),
                    backgroundColor: 'rgba(52, 152, 219, 0.8)'
                }]
            });
        }
        
        // Version Distribution Chart
        if (versionDist && versionDist.distribution) {
            createBarChart('version-distribution-chart', {
                labels: versionDist.distribution.map(d => d.range),
                datasets: [{
                    label: 'Users',
                    data: versionDist.distribution.map(d => d.users),
                    backgroundColor: 'rgba(46, 204, 113, 0.8)'
                }]
            });
        }
        
        // Feature Adoption Timeline Chart
        if (adoptionTimeline && adoptionTimeline.dates) {
            createLineChart('feature-timeline-chart', {
                labels: adoptionTimeline.dates,
                datasets: [
                    {
                        label: 'Context Created',
                        data: adoptionTimeline.context_created || [],
                        borderColor: 'rgb(52, 152, 219)',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Dashboard Visits',
                        data: adoptionTimeline.dashboard_visits || [],
                        borderColor: 'rgb(46, 204, 113)',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Feedback Submitted',
                        data: adoptionTimeline.feedback_submitted || [],
                        borderColor: 'rgb(241, 196, 15)',
                        backgroundColor: 'rgba(241, 196, 15, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Upgrade Interest',
                        data: adoptionTimeline.upgrade_interest || [],
                        borderColor: 'rgb(155, 89, 182)',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            });
        }
    });
}

// Update load functions to include charts
async function loadOverviewData() {
    try {
        const [kpis, insights, timeline, boxDist, llmDist, lifecycle, perfHealth] = await Promise.all([
            fetchAPI(`/admin/analytics/overview/kpis?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/overview/insights?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/overview/growth-timeline?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/overview/context-box-distribution?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/overview/llm-distribution?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/overview/user-lifecycle`),
            fetchAPI(`/admin/analytics/overview/performance-health`)
        ]);

        // Update KPIs
        updateKPI('total-users', kpis.total_users);
        updateKPI('active-users-7d', kpis.active_users_7d);
        updateKPI('context-copies-7d', kpis.context_copies_7d);
        updateKPI('avg-copies-per-user', kpis.avg_copies_per_user);
        updateKPI('new-signups-7d', kpis.new_signups_7d);
        updateKPI('upgrade-interest-total', kpis.upgrade_interest_total);
        updateKPI('onboarding-completion-rate', kpis.onboarding_completion_rate + '%');
        updateKPI('retention-7d', kpis.retention_7d + '%');

        // Update insights
        const insightsList = document.getElementById('key-insights-list');
        if (insightsList && insights.insights) {
            insightsList.innerHTML = insights.insights.map(insight => `<li>${insight}</li>`).join('');
        }
        
        // Update lifecycle stats
        if (lifecycle) {
            const lifecycleContainer = document.getElementById('user-lifecycle-stats');
            if (lifecycleContainer) {
                const active = lifecycle.active_users || lifecycle.active;
                const dormant = lifecycle.dormant_users || lifecycle.dormant;
                lifecycleContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">
                            <span class="status-indicator healthy"></span> Active Users
                        </span>
                        <span class="metric-item-value">${formatNumber(active.count)} (${active.percentage}%)</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">
                            <span class="status-indicator critical"></span> Dormant Users
                        </span>
                        <span class="metric-item-value">${formatNumber(dormant.count)} (${dormant.percentage}%)</span>
                    </div>
                `;
            }
        }
        
        // Update performance health
        if (perfHealth) {
            const perfContainer = document.getElementById('performance-health-stats');
            if (perfContainer) {
                const retrievalTime = perfHealth.avg_retrieval_time_ms;
                const uptime = perfHealth.uptime_percent;
                const totalRetrievals = perfHealth.total_retrievals_7d || 0;
                perfContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">Avg Retrieval Time</span>
                        <span class="metric-item-value" style="color: #2ecc71;">${retrievalTime !== null && retrievalTime !== undefined ? retrievalTime + 'ms' : 'N/A'}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Uptime</span>
                        <span class="metric-item-value" style="color: #2ecc71;">${uptime ? uptime + '%' : 'N/A'}</span>
                    </div>
                `;
                console.log('Performance Health:', { retrievalTime, uptime, totalRetrievals });
            }
        }
        
        // Update chart title based on time range
        const titleMap = {
            '7d': 'Last 7 Days',
            '30d': 'Last 30 Days',
            '90d': 'Last 90 Days',
            'all_time': 'All Time'
        };
        const titleElement = document.getElementById('growth-timeline-title');
        if (titleElement) {
            titleElement.textContent = `User Growth & Activity (${titleMap[currentTimeRange] || 'Last 30 Days'})`;
        }
        
        // Update charts
        await updateOverviewCharts(timeline, boxDist, llmDist);

        console.log('Overview data loaded:', {kpis, insights, lifecycle, perfHealth});
    } catch (error) {
        console.error('Error loading overview data:', error);
    }
}

async function loadAcquisitionData() {
    try {
        const [metrics, funnel, timeline, churn, patterns] = await Promise.all([
            fetchAPI(`/admin/analytics/acquisition/metrics?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/acquisition/funnel?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/acquisition/growth-timeline?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/acquisition/churn`),
            fetchAPI(`/admin/analytics/acquisition/signup-patterns?time_range=${currentTimeRange}`)
        ]);

        // Update KPIs
        updateKPI('acquisition-total-users', metrics.total_registered_users);
        updateKPI('acquisition-dau', metrics.dau);
        updateKPI('acquisition-wau', metrics.wau);
        updateKPI('acquisition-mau', metrics.mau);
        
        // Update KPI changes
        const totalChange = document.getElementById('acquisition-total-users-change');
        if (totalChange) {
            const change = metrics.total_registered_change_percent || 0;
            totalChange.textContent = change > 0 ? `↑ ${change}%` : change < 0 ? `↓ ${Math.abs(change)}%` : '';
            totalChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const dauChange = document.getElementById('acquisition-dau-change');
        if (dauChange) {
            const change = metrics.dau_change_percent || 0;
            dauChange.textContent = change > 0 ? `↑ ${change}% vs yesterday` : change < 0 ? `↓ ${Math.abs(change)}% vs yesterday` : '';
            dauChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const wauChange = document.getElementById('acquisition-wau-change');
        if (wauChange) {
            const change = metrics.wau_change_percent || 0;
            wauChange.textContent = change > 0 ? `↑ ${change}% vs last week` : change < 0 ? `↓ ${Math.abs(change)}% vs last week` : '';
            wauChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const mauChange = document.getElementById('acquisition-mau-change');
        if (mauChange) {
            const change = metrics.mau_change_percent || 0;
            mauChange.textContent = change > 0 ? `↑ ${change}% vs last month` : change < 0 ? `↓ ${Math.abs(change)}% vs last month` : '';
            mauChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        // Update churn analysis
        if (churn) {
            const churnContainer = document.getElementById('churn-analysis-stats');
            if (churnContainer) {
                churnContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">Weekly Churn Rate</span>
                        <span class="metric-item-value">${churn.weekly_churn_rate}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">30-Day Churn</span>
                        <span class="metric-item-value">${churn.monthly_churn_rate}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Never Activated</span>
                        <span class="metric-item-value">${formatNumber(churn.never_activated_users || churn.never_activated_count || 0)} users</span>
                    </div>
                `;
            }
        }
        
        // Update funnel table
        if (funnel && funnel.funnel) {
            const tableBody = document.getElementById('funnel-table-body');
            if (tableBody) {
                tableBody.innerHTML = funnel.funnel.map((stage, index) => {
                    const count = formatNumber(stage.count);
                    const conversion = `${stage.conversion_rate}%`;
                    const lostUsers = stage.drop_off > 0 ? formatNumber(stage.drop_off) : '-';
                    
                    return `
                        <tr>
                            <td>${stage.stage}</td>
                            <td class="metric-value">${count}</td>
                            <td>${conversion}</td>
                            <td>${lostUsers}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Update charts
        await updateAcquisitionCharts(timeline, funnel, patterns);

        console.log('Acquisition data loaded:', {metrics, funnel, churn, patterns});
    } catch (error) {
        console.error('Error loading acquisition data:', error);
    }
}

async function loadEngagementData() {
    try {
        const [metrics, boxUsage, powerUsers, copyActivity, versionStats, onboardingFunnel] = await Promise.all([
            fetchAPI(`/admin/analytics/engagement/metrics?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/engagement/context-box-usage?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/engagement/power-users?time_range=${currentTimeRange}&limit=5`),
            fetchAPI(`/admin/analytics/engagement/copy-activity-timeline?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/engagement/version-stats`),
            fetchAPI(`/admin/analytics/engagement/onboarding-funnel`)
        ]);

        // Update KPIs
        updateKPI('engagement-total-copies', metrics.total_context_copies);
        updateKPI('engagement-avg-copies', metrics.avg_copies_per_active_user);
        updateKPI('engagement-new-versions', metrics.new_versions_created);
        
        // Update KPI changes
        const totalCopiesChange = document.getElementById('engagement-total-copies-change');
        if (totalCopiesChange) {
            const change = metrics.total_context_copies_change_percent || 0;
            totalCopiesChange.textContent = change > 0 ? `↑ ${change}% vs last week` : change < 0 ? `↓ ${Math.abs(change)}% vs last week` : '';
            totalCopiesChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const avgCopiesChange = document.getElementById('engagement-avg-copies-change');
        if (avgCopiesChange) {
            const change = metrics.avg_copies_change_percent || 0;
            avgCopiesChange.textContent = change > 0 ? `↑ ${change}% vs last week` : change < 0 ? `↓ ${Math.abs(change)}% vs last week` : '';
            avgCopiesChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const newVersionsChange = document.getElementById('engagement-new-versions-change');
        if (newVersionsChange) {
            const change = metrics.new_versions_change_percent || 0;
            newVersionsChange.textContent = change > 0 ? `↑ ${change}% vs last week` : change < 0 ? `↓ ${Math.abs(change)}% vs last week` : '';
            newVersionsChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        // Update box usage breakdown
        if (boxUsage) {
            const boxIcons = {
                'career': '💼',
                'work': '🏢',
                'travel': '✈️',
                'health': '🏥',
                'custom': '⚙️'
            };
            const boxColors = {
                'career': '',
                'work': 'green',
                'travel': 'orange',
                'health': 'purple',
                'custom': 'red'
            };
            const boxContainer = document.getElementById('box-usage-breakdown');
            if (boxContainer) {
                const boxes = Object.entries(boxUsage).sort((a, b) => b[1].copies - a[1].copies);
                boxContainer.innerHTML = boxes.map(([boxName, data]) => {
                    const icon = boxIcons[boxName] || '📦';
                    const color = boxColors[boxName] || '';
                    return `
                        <div class="metric-item">
                            <div>
                                <div class="metric-item-label">${icon} ${boxName.charAt(0).toUpperCase() + boxName.slice(1)}</div>
                                <div class="progress-bar">
                                    <div class="progress-fill ${color}" style="width: ${data.percentage}%"></div>
                                </div>
                            </div>
                            <span class="metric-item-value">${formatNumber(data.copies)}</span>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Update version stats
        if (versionStats) {
            const versionContainer = document.getElementById('version-stats-list');
            if (versionContainer) {
                versionContainer.innerHTML = `
                    <div class="metric-item">
                        <span class="metric-item-label">Total Versions</span>
                        <span class="metric-item-value">${formatNumber(versionStats.total_versions)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Avg Versions/Box</span>
                        <span class="metric-item-value">${versionStats.avg_versions_per_box}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Avg Days Between Updates</span>
                        <span class="metric-item-value">${versionStats.avg_days_between_updates}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-item-label">Users with 5+ Versions</span>
                        <span class="metric-item-value">${formatNumber(versionStats.users_with_5plus_versions)}</span>
                    </div>
                `;
            }
        }
        
        // Update power users table
        if (powerUsers && powerUsers.users) {
            const tableBody = document.getElementById('power-users-table-body');
            if (tableBody) {
                const boxIcons = {
                    'Career': '💼',
                    'Work': '🏢',
                    'Travel': '✈️',
                    'Health': '🏥',
                    'Custom': '⚙️'
                };
                tableBody.innerHTML = powerUsers.users.map(user => {
                    const icon = boxIcons[user.most_used_box] || '📦';
                    return `
                        <tr>
                            <td>${user.user_id}</td>
                            <td class="metric-value">${formatNumber(user.context_copies_7d)}</td>
                            <td>${user.versions_created}</td>
                            <td>${icon} ${user.most_used_box}</td>
                            <td>${user.sessions}</td>
                            <td><span class="trend-badge ${user.status === 'Power User' ? 'up' : ''}">${user.status}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }
        
        // Update onboarding funnel stats
        if (onboardingFunnel && onboardingFunnel.stages) {
            const funnelContainer = document.getElementById('onboarding-funnel-stats');
            if (funnelContainer) {
                funnelContainer.innerHTML = onboardingFunnel.stages.map(stage => `
                    <div class="metric-item">
                        <span class="metric-item-label">${stage.stage}</span>
                        <span class="metric-item-value">${formatNumber(stage.count)} (${stage.percentage}%)</span>
                    </div>
                `).join('');
            }
        }

        // Update charts
        await updateEngagementCharts(copyActivity, boxUsage, onboardingFunnel);

        console.log('Engagement data loaded:', {metrics, boxUsage, powerUsers, versionStats, onboardingFunnel});
    } catch (error) {
        console.error('Error loading engagement data:', error);
    }
}

async function loadLLMData() {
    try {
        const [metrics, distribution, platforms, usageTrends, platformDetails, diversity] = await Promise.all([
            fetchAPI(`/admin/analytics/llm/metrics?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/llm/platform-distribution?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/llm/copies-by-platform?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/llm/usage-trends?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/llm/platform-details?time_range=${currentTimeRange}`),
            fetchAPI(`/admin/analytics/llm/user-diversity?time_range=${currentTimeRange}`)
        ]);

        // Update KPIs
        updateKPI('llm-total-apps', metrics.total_llm_apps_used);
        updateKPI('llm-avg-per-user', metrics.avg_llms_per_user);
        updateKPI('llm-multi-users', metrics.multi_llm_users);
        updateKPI('llm-cross-platform', metrics.cross_platform_sessions);
        
        // Update KPI changes
        const avgChange = document.getElementById('llm-avg-change');
        if (avgChange) {
            const change = metrics.avg_llms_change || 0;
            avgChange.textContent = change > 0 ? `↑ ${change}% vs last period` : change < 0 ? `↓ ${Math.abs(change)}% vs last period` : '';
            avgChange.className = `kpi-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        
        const multiPercent = document.getElementById('llm-multi-percent');
        if (multiPercent) {
            multiPercent.textContent = `${metrics.multi_llm_percent}% of active users`;
        }
        
        const crossPlatformPercent = document.getElementById('llm-cross-platform-percent');
        if (crossPlatformPercent) {
            crossPlatformPercent.textContent = `${metrics.cross_platform_percent}% of all sessions`;
        }
        
        // Update copies breakdown
        if (platforms && platforms.platforms) {
            const breakdownContainer = document.getElementById('llm-copies-breakdown');
            if (breakdownContainer) {
                const colors = {
                    'ChatGPT': '',
                    'Claude': 'purple',
                    'Gemini': 'orange',
                    'Perplexity': 'green',
                    'Other Platforms': 'red'
                };
                breakdownContainer.innerHTML = platforms.platforms.map(platform => {
                    const color = colors[platform.name] || '';
                    return `
                        <div class="metric-item">
                            <div>
                                <div class="metric-item-label">${platform.name} (${platform.site})</div>
                                <div class="progress-bar">
                                    <div class="progress-fill ${color}" style="width: ${platform.percentage}%"></div>
                                </div>
                            </div>
                            <span class="metric-item-value">${formatNumber(platform.copies)}</span>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Update platform details table
        if (platformDetails && platformDetails.platforms) {
            const tableBody = document.getElementById('llm-platform-details-body');
            if (tableBody) {
                tableBody.innerHTML = platformDetails.platforms.map(platform => {
                    const growth = platform.growth > 0 ? `+${platform.growth}%` : platform.growth < 0 ? `${platform.growth}%` : 'Stable';
                    const growthClass = platform.growth > 0 ? 'up' : platform.growth < 0 ? 'down' : 'stable';
                    
                    // For "Other" platform, show which LLMs are included
                    let platformName = platform.platform;
                    if (platform.platform === 'Other' && platform.other_llms && platform.other_llms.length > 0) {
                        const otherList = platform.other_llms.slice(0, 3).join(', '); // Show first 3
                        const moreCount = platform.other_llms.length > 3 ? ` +${platform.other_llms.length - 3} more` : '';
                        platformName = `Other (${otherList}${moreCount})`;
                    }
                    
                    return `
                        <tr>
                            <td>${platformName}</td>
                            <td class="metric-value">${formatNumber(platform.unique_users)}</td>
                            <td>${formatNumber(platform.total_copies)}</td>
                            <td>${platform.avg_copies_per_user}</td>
                            <td>${platform.market_share}%</td>
                            <td><span class="trend-badge ${growthClass}">${growth}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Update charts
        await updateLLMCharts(distribution, platforms, usageTrends, diversity);

        console.log('LLM data loaded:', {metrics, distribution, platforms, usageTrends, platformDetails, diversity});
    } catch (error) {
        console.error('Error loading LLM data:', error);
    }
}

// DB View functions
let currentDBTable = 'users';
let currentDBPage = 1;
const DB_PAGE_SIZE = 10;

async function loadDBViewData() {
    const select = document.getElementById('dbview-table-select');
    if (select && select.value !== currentDBTable) {
        // Table changed, reset to page 1
        currentDBTable = select.value;
        currentDBPage = 1;
    }
    
    try {
        const response = await fetchAPI(`/admin/analytics/dbview/${currentDBTable}?page=${currentDBPage}&page_size=${DB_PAGE_SIZE}`);
        
        if (response) {
            updateDBViewTable(response);
        }
    } catch (error) {
        console.error('Error loading DB view data:', error);
    }
}

async function loadDBViewPage(direction) {
    if (direction === 'next') {
        currentDBPage++;
    } else if (direction === 'prev' && currentDBPage > 1) {
        currentDBPage--;
    }
    
    await loadDBViewData();
}

function updateDBViewTable(data) {
    const titleEl = document.getElementById('dbview-table-title');
    const totalCountEl = document.getElementById('dbview-total-count');
    const pageInfoEl = document.getElementById('dbview-page-info');
    const prevBtn = document.getElementById('dbview-prev-btn');
    const nextBtn = document.getElementById('dbview-next-btn');
    const tableHead = document.getElementById('dbview-table-head');
    const tableBody = document.getElementById('dbview-table-body');
    
    if (titleEl) {
            const tableNames = {
                'users': 'Users',
                'contexts': 'Context Versions',
                'feedbacks': 'Feedbacks',
                'upgrades': 'Upgrade Interests',
                'analytics': 'Analytics Events'
            };
        titleEl.textContent = tableNames[currentDBTable] || currentDBTable;
    }
    
    if (totalCountEl) {
        totalCountEl.textContent = data.total || 0;
    }
    
    const totalPages = Math.ceil((data.total || 0) / DB_PAGE_SIZE);
    if (pageInfoEl) {
        pageInfoEl.textContent = `Page ${currentDBPage} of ${totalPages || 1}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentDBPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentDBPage >= totalPages;
    }
    
    if (tableHead && data.headers) {
        tableHead.innerHTML = `<tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    }
    
    if (tableBody && data.rows) {
        tableBody.innerHTML = data.rows.map(row => {
            // Format cells - handle long text with word-wrap
            const cells = row.map(cell => {
                const cellText = cell || '';
                // If it's JSON-like (starts with { or [), format it nicely
                if (cellText.trim().startsWith('{') || cellText.trim().startsWith('[')) {
                    return `<td style="word-wrap: break-word; max-width: 400px; white-space: pre-wrap; font-family: monospace; font-size: 11px;">${cellText}</td>`;
                }
                // For long text, allow wrapping
                if (cellText.length > 100) {
                    return `<td style="word-wrap: break-word; max-width: 300px; white-space: pre-wrap;">${cellText}</td>`;
                }
                return `<td>${cellText}</td>`;
            });
            return `<tr>${cells.join('')}</tr>`;
        }).join('');
    }
}

