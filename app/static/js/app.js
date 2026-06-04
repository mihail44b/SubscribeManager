// App state
let API_TOKEN = localStorage.getItem('token') || '';
let currentUser = null;
let categoriesList = [];
let subscriptionsList = [];

// API Endpoint configuration (Relative paths because it is served from FastAPI)
const API_BASE = '/api';

// Vibrant color palette for charts
const CATEGORY_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#f97316', // Orange
    '#14b8a6'  // Teal
];

// Document Elements
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    if (API_TOKEN) {
        showScreen('dashboard-screen');
        loadDashboardData();
    } else {
        showScreen('auth-screen');
    }
}

// Helper to show/hide screens
function showScreen(screenId) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

// Toggle Login/Register Tabs
function switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authSubtitle = document.getElementById('auth-subtitle');
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authSubtitle.textContent = 'Manage subscriptions, optimize budgets';
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authSubtitle.textContent = 'Create your account to start tracking';
    }
}

// Toast Notifications Helper
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Headers builder helper
function getHeaders(contentType = 'application/json') {
    const headers = {};
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    if (API_TOKEN) {
        headers['Authorization'] = `Bearer ${API_TOKEN}`;
    }
    return headers;
}

// Authentication Actions
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    // OAuth2 uses form-encoded requests
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: getHeaders('application/x-www-form-urlencoded'),
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Login failed. Check credentials.');
        }

        const data = await response.json();
        API_TOKEN = data.access_token;
        localStorage.setItem('token', API_TOKEN);
        showToast('Login successful!');
        showScreen('dashboard-screen');
        loadDashboardData();
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const currency = document.getElementById('register-currency').value;
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, password, currency })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Registration failed.');
        }

        showToast('Registration successful! Please log in.');
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    API_TOKEN = '';
    currentUser = null;
    localStorage.removeItem('token');
    showToast('Logged out');
    showScreen('auth-screen');
    // Clear forms
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
}

// Load Dashboard Data
async function loadDashboardData() {
    try {
        await fetchCurrentUser();
        await loadCategories();
        await loadSubscriptions();
        await loadAnalytics();
    } catch (err) {
        console.error('Error loading dashboard data:', err);
        if (err.status === 401) {
            handleLogout();
        } else {
            showToast('Failed to load dashboard data', 'error');
        }
    }
}

async function fetchCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me`, {
        headers: getHeaders()
    });
    if (!response.ok) {
        const err = new Error('Session expired');
        err.status = response.status;
        throw err;
    }
    currentUser = await response.json();
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('user-currency-lbl').textContent = currentUser.currency;
}

async function loadCategories() {
    const response = await fetch(`${API_BASE}/categories`, {
        headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to load categories');
    categoriesList = await response.json();
    populateCategoryDropdown();
}

function populateCategoryDropdown() {
    const select = document.getElementById('sub-category');
    select.innerHTML = '';
    categoriesList.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

async function loadSubscriptions() {
    const response = await fetch(`${API_BASE}/subscriptions`, {
        headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to load subscriptions');
    subscriptionsList = await response.json();
    renderSubscriptionsList();
}

function renderSubscriptionsList() {
    const container = document.getElementById('subs-list-container');
    container.innerHTML = '';

    if (subscriptionsList.length === 0) {
        container.innerHTML = `
            <div class="card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                🪐 No subscriptions yet. Click "+ Add Subscription" to start tracking!
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    subscriptionsList.forEach(sub => {
        const nextDate = new Date(sub.next_payment_date);
        nextDate.setHours(0,0,0,0);
        
        // Calculate days remaining
        const diffTime = nextDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let statusBadgeHtml = '';
        if (sub.is_active) {
            if (diffDays < 0) {
                statusBadgeHtml = `<span class="badge badge-overdue">Overdue (${Math.abs(diffDays)}d)</span>`;
            } else if (diffDays <= 2) {
                statusBadgeHtml = `<span class="badge badge-soon">Due in ${diffDays}d</span>`;
            }
        }

        const categoryName = sub.category ? sub.category.name : 'General';
        const cardClass = sub.is_active ? 'sub-row card' : 'sub-row card inactive';

        // Choose visual category icon
        let categoryIcon = '💸';
        const lowerCat = categoryName.toLowerCase();
        if (lowerCat.includes('stream') || lowerCat.includes('netflix') || lowerCat.includes('youtube')) categoryIcon = '📺';
        else if (lowerCat.includes('utilit') || lowerCat.includes('water') || lowerCat.includes('electr')) categoryIcon = '⚡';
        else if (lowerCat.includes('mobil') || lowerCat.includes('phone') || lowerCat.includes('internet')) categoryIcon = '📱';
        else if (lowerCat.includes('soft') || lowerCat.includes('cloud') || lowerCat.includes('aws')) categoryIcon = '☁️';
        else if (lowerCat.includes('service') || lowerCat.includes('sub')) categoryIcon = '⚙️';
        else if (lowerCat.includes('gym') || lowerCat.includes('fit') || lowerCat.includes('sport')) categoryIcon = '💪';

        const row = document.createElement('div');
        row.className = cardClass;
        row.innerHTML = `
            <div class="sub-info-block">
                <div class="sub-avatar">${categoryIcon}</div>
                <div class="sub-details">
                    <span class="sub-name">${escapeHTML(sub.title)}</span>
                    <div class="sub-meta">
                        <span class="sub-category-badge">${escapeHTML(categoryName)}</span>
                        <span class="sub-date-badge">
                            📅 Next: ${sub.next_payment_date} 
                            ${statusBadgeHtml}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="sub-actions-container">
                <div class="sub-pricing">
                    <span class="sub-cost">${sub.amount} ${sub.currency}</span>
                    <span class="sub-freq">/ ${sub.billing_period}</span>
                </div>
                <div class="sub-actions">
                    ${sub.is_active ? `
                        <button class="action-icon-btn btn-pay" title="Mark as Paid" onclick="paySubscription(${sub.id})">
                            ✓ Paid
                        </button>
                    ` : ''}
                    <button class="action-icon-btn" title="Edit" onclick="editSubscription(${sub.id})">✏️</button>
                    <button class="action-icon-btn btn-delete" title="Delete" onclick="deleteSubscription(${sub.id})">🗑️</button>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

// Mark Paid Action
async function paySubscription(id) {
    try {
        const response = await fetch(`${API_BASE}/subscriptions/${id}/pay`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (!response.ok) throw new Error('Payment recording failed');
        
        showToast('Payment logged! Due date updated.');
        await loadSubscriptions();
        await loadAnalytics();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete Action
async function deleteSubscription(id) {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) throw new Error('Deletion failed');
        
        showToast('Subscription deleted');
        await loadSubscriptions();
        await loadAnalytics();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Load Analytics
async function loadAnalytics() {
    const response = await fetch(`${API_BASE}/analytics`, {
        headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to load analytics');
    const analytics = await response.json();

    // 1. Update forecasts
    document.getElementById('forecast-30').textContent = `${analytics.forecast.forecast_30} ${analytics.currency}`;
    document.getElementById('forecast-90').textContent = `${analytics.forecast.forecast_90} ${analytics.currency}`;
    document.getElementById('forecast-365').textContent = `${analytics.forecast.forecast_365} ${analytics.currency}`;

    // 2. Render SVG Donut and Legend
    renderSpendChart(analytics.current_month_spend, analytics.currency);
}

function renderSpendChart(spendData, currency) {
    const svg = document.getElementById('svg-donut');
    const legend = document.getElementById('chart-legend');
    
    // Clear dynamic segments and legend
    svg.querySelectorAll('.dynamic-slice').forEach(el => el.remove());
    legend.innerHTML = '';

    // Calculate total spend
    const total = spendData.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    document.getElementById('month-total').textContent = total.toFixed(2);

    if (total === 0) {
        // Just show default circle
        return;
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius; // ~251.327
    let currentOffset = 0;

    spendData.forEach((item, index) => {
        const amount = parseFloat(item.amount);
        const percent = amount / total;
        const strokeLength = percent * circumference;
        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

        // Create circle slice
        // Stroke dasharray: <dash length> <space length>
        // Stroke dashoffset: where the circle starts (negative offset rotates it clockwise)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'dynamic-slice');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', radius.toString());
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '12');
        circle.setAttribute('stroke-dasharray', `${strokeLength} ${circumference}`);
        circle.setAttribute('stroke-dashoffset', (-currentOffset).toString());
        // Rotate 90deg counterclockwise to start from 12 o'clock position
        circle.setAttribute('transform', 'rotate(-90 50 50)');
        
        svg.appendChild(circle);
        
        currentOffset += strokeLength;

        // Create Legend item
        const legendRow = document.createElement('div');
        legendRow.className = 'legend-item';
        legendRow.innerHTML = `
            <div class="legend-left">
                <span class="legend-dot" style="background-color: ${color}"></span>
                <span class="legend-name">${escapeHTML(item.category_name)}</span>
            </div>
            <span class="legend-val">${amount.toFixed(2)} ${currency} (${(percent * 100).toFixed(0)}%)</span>
        `;
        legend.appendChild(legendRow);
    });
}

// Modal Form handling
function openSubscriptionModal(subToEdit = null) {
    const modal = document.getElementById('sub-modal');
    const form = document.getElementById('sub-form');
    const title = document.getElementById('modal-title');
    const errDiv = document.getElementById('modal-error');
    
    errDiv.classList.add('hidden');
    form.reset();
    hideCustomCategoryInput();

    // Default dates is today
    document.getElementById('sub-date').value = new Date().toISOString().substring(0, 10);

    if (subToEdit) {
        title.textContent = 'Edit Subscription';
        document.getElementById('sub-id').value = subToEdit.id;
        document.getElementById('sub-title').value = subToEdit.title;
        document.getElementById('sub-amount').value = subToEdit.amount;
        document.getElementById('sub-currency').value = subToEdit.currency;
        document.getElementById('sub-period').value = subToEdit.billing_period;
        document.getElementById('sub-date').value = subToEdit.next_payment_date;
        document.getElementById('sub-category').value = subToEdit.category_id || '';
        document.getElementById('sub-active').checked = subToEdit.is_active;
    } else {
        title.textContent = 'Add Subscription';
        document.getElementById('sub-id').value = '';
    }

    modal.classList.remove('hidden');
}

function closeSubscriptionModal(event = null) {
    document.getElementById('sub-modal').classList.add('hidden');
}

async function editSubscription(id) {
    const sub = subscriptionsList.find(s => s.id === id);
    if (sub) {
        openSubscriptionModal(sub);
    }
}

async function handleSubSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('sub-id').value;
    const title = document.getElementById('sub-title').value;
    const amount = parseFloat(document.getElementById('sub-amount').value);
    const currency = document.getElementById('sub-currency').value;
    const billing_period = document.getElementById('sub-period').value;
    const next_payment_date = document.getElementById('sub-date').value;
    const category_id = document.getElementById('sub-category').value ? parseInt(document.getElementById('sub-category').value) : null;
    const is_active = document.getElementById('sub-active').checked;
    const errDiv = document.getElementById('modal-error');

    const subData = {
        title,
        amount,
        currency,
        billing_period,
        next_payment_date,
        category_id
    };

    let url = `${API_BASE}/subscriptions`;
    let method = 'POST';

    if (id) {
        url += `/${id}`;
        method = 'PUT';
        subData.is_active = is_active;
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(subData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to save subscription');
        }

        closeSubscriptionModal();
        showToast(id ? 'Subscription updated' : 'Subscription added');
        await loadSubscriptions();
        await loadAnalytics();
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

// Custom Category Form Action
function showCustomCategoryInput() {
    document.getElementById('custom-category-group').classList.remove('hidden');
}

function hideCustomCategoryInput() {
    document.getElementById('custom-category-group').classList.add('hidden');
    document.getElementById('custom-category-name').value = '';
}

async function saveCustomCategory() {
    const name = document.getElementById('custom-category-name').value.trim();
    if (!name) return;

    try {
        const response = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to create category');
        }

        const newCat = await response.json();
        showToast(`Category "${newCat.name}" created`);
        
        // Reload list and select it
        await loadCategories();
        document.getElementById('sub-category').value = newCat.id;
        hideCustomCategoryInput();
    } catch (err) {
        alert(err.message);
    }
}

// Utility function to avoid HTML Injection
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
