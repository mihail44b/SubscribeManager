// App state
let API_TOKEN = localStorage.getItem('token') || '';
let currentUser = null;
let categoriesList = [];
let subscriptionsList = [];
let currentLang = localStorage.getItem('lang') || 'en';

// Translations
const TRANSLATIONS = {
    en: {
        forecast_title: '🚀 Expense Forecast',
        forecast_30: 'Next 30 Days',
        forecast_90: 'Next 90 Days',
        forecast_365: 'Next 365 Days',
        spend_title: '📊 Current Month Spend',
        subscriptions: 'Subscriptions',
        add_subscription: 'Add Subscription',
        add_subscription_title: 'Add Subscription',
        edit_subscription_title: 'Edit Subscription',
        lbl_title: 'Title',
        lbl_amount: 'Price / Amount',
        lbl_billing: 'Billing Period',
        monthly: 'Monthly',
        annually: 'Annually',
        lbl_date: 'Next Payment Date',
        lbl_category: 'Category',
        lbl_active: 'Subscription is active',
        cancel: 'Cancel',
        save_subscription: 'Save Subscription',
        logout: 'Logout',
        custom: 'Custom',
        new_category_name: 'New Category Name',
        category_placeholder: 'E.g., Gym, Transport',
        create: 'Create',
        cancel_small: 'Cancel',
        overdue: 'Overdue',
        due_in: 'Due in',
        days: 'd',
        edit: 'Edit',
        pay: 'Pay',
        delete: 'Delete',
        no_subs: '🪐 No subscriptions yet. Click "+ Add Subscription" to start tracking!',
        per_month: '/mo',
        per_year: '/yr',
        toast_added: 'Subscription added',
        toast_updated: 'Subscription updated',
        toast_deleted: 'Subscription deleted',
        toast_paid: 'Payment recorded',
        err_save_sub: 'Failed to save subscription',
        err_server: 'Server error. Check the entered values.',
        err_generic: 'Error',
        err_amount_too_large: 'Amount is too large. Maximum is 99,999,999.99',
    },
    ru: {
        forecast_title: '🚀 Прогноз расходов',
        forecast_30: 'След. 30 дней',
        forecast_90: 'След. 90 дней',
        forecast_365: 'След. 365 дней',
        spend_title: '📊 Расходы за месяц',
        subscriptions: 'Подписки',
        add_subscription: 'Добавить подписку',
        add_subscription_title: 'Добавить подписку',
        edit_subscription_title: 'Редактировать подписку',
        lbl_title: 'Название',
        lbl_amount: 'Сумма',
        lbl_billing: 'Период оплаты',
        monthly: 'Ежемесячно',
        annually: 'Ежегодно',
        lbl_date: 'Дата следующей оплаты',
        lbl_category: 'Категория',
        lbl_active: 'Подписка активна',
        cancel: 'Отмена',
        save_subscription: 'Сохранить',
        logout: 'Выйти',
        custom: 'Своя',
        new_category_name: 'Название новой категории',
        category_placeholder: 'Например, Спортзал, Транспорт',
        create: 'Создать',
        cancel_small: 'Отмена',
        overdue: 'Просрочено',
        due_in: 'Через',
        days: 'д',
        edit: 'Изменить',
        pay: 'Оплатить',
        delete: 'Удалить',
        no_subs: '🪐 Подписок пока нет. Нажми "+ Добавить подписку"!',
        per_month: '/мес',
        per_year: '/год',
        toast_added: 'Подписка добавлена',
        toast_updated: 'Подписка обновлена',
        toast_deleted: 'Подписка удалена',
        toast_paid: 'Оплата записана',
        err_save_sub: 'Не удалось сохранить подписку',
        err_server: 'Ошибка сервера. Проверьте введённые значения.',
        err_generic: 'Ошибка',
        err_amount_too_large: 'Сумма слишком большая. Максимум: 99 999 999.99',
    }
};


function t(key) {
    return (TRANSLATIONS[currentLang] || TRANSLATIONS['en'])[key] || key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

function handleLangChange(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'ru' ? 'ru-RU' : 'en-GB';
    applyTranslations();
    updateDateFieldLocale(lang);
    renderSubscriptionsList();
}

// Switches the date input between native (en) and text mask (ru)
function updateDateFieldLocale(lang) {
    const field = document.getElementById('sub-date');
    if (!field) return;
    const currentVal = field.getAttribute('data-iso') || field.value;

    if (lang === 'ru') {
        // Switch to text input with dd.mm.yyyy display
        field.type = 'text';
        field.placeholder = 'дд.мм.гггг';
        field.removeAttribute('required');
        field.oninput = function() { maskDateRu(this); };
        field.setAttribute('data-mode', 'ru');
        // Convert existing iso value to display format
        if (currentVal && currentVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = currentVal.split('-');
            field.value = `${d}.${m}.${y}`;
            field.setAttribute('data-iso', currentVal);
        }
    } else {
        // Switch back to native date input
        field.type = 'date';
        field.placeholder = '';
        field.setAttribute('required', '');
        field.oninput = null;
        field.removeAttribute('data-mode');
        // Convert display format back to iso
        const iso = field.getAttribute('data-iso') || '';
        field.value = iso;
    }
}

function maskDateRu(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length >= 3) v = v.slice(0, 2) + '.' + v.slice(2);
    if (v.length >= 6) v = v.slice(0, 5) + '.' + v.slice(5);
    input.value = v;
    // Store iso value when complete
    const parts = v.split('.');
    if (parts.length === 3 && parts[2].length === 4) {
        input.setAttribute('data-iso', `${parts[2]}-${parts[1]}-${parts[0]}`);
    }
}

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
    '#14b8a6' // Teal
];

// Document Elements
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    document.documentElement.lang = currentLang === 'ru' ? 'ru-RU' : 'en-GB';
    applyTranslations();
    const langSelect = document.getElementById('nav-lang');
    if (langSelect) langSelect.value = currentLang;
    updateDateFieldLocale(currentLang);

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

// Show sub-form within auth screen
function showAuthForm(form) {
    const forms = ['login-form', 'register-form', 'verify-screen', 'forgot-screen', 'reset-screen'];
    const tabs = document.getElementById('auth-tabs') || document.querySelector('.auth-tabs');
    forms.forEach(f => document.getElementById(f)?.classList.add('hidden'));
    document.getElementById('auth-error')?.classList.add('hidden');
    document.getElementById('verify-error')?.classList.add('hidden');
    document.getElementById('forgot-error')?.classList.add('hidden');
    document.getElementById('reset-error')?.classList.add('hidden');

    if (form === 'login' || form === 'register') {
        if (tabs) tabs.classList.remove('hidden');
        switchAuthTab(form);
    } else {
        if (tabs) tabs.classList.add('hidden');
        document.getElementById(`${form}-screen`)?.classList.remove('hidden');
    }
    showScreen('auth-screen');
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
            // 403 = not verified — redirect to verify screen
            if (response.status === 403) {
                pendingEmail = email;
                document.getElementById('verify-email-hint').textContent = email;
                showAuthForm('verify');
                return;
            }
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

// Stores email between screens
let pendingEmail = '';

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

        pendingEmail = email;
        document.getElementById('verify-email-hint').textContent = email;
        showAuthForm('verify');
        showToast('Check your inbox for the verification code!');
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

async function handleVerifyEmail() {
    const code = document.getElementById('verify-code').value.trim();
    const errDiv = document.getElementById('verify-error');
    errDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/auth/verify-email`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email: pendingEmail, code })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Invalid code.');

        API_TOKEN = data.access_token;
        localStorage.setItem('token', API_TOKEN);
        showToast('Email verified! Welcome to SubSpace 🪐');
        showScreen('dashboard-screen');
        loadDashboardData();
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

async function handleResendCode() {
    await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email: pendingEmail })
    });
    showToast('Code resent! Check your inbox.');
}

async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    const errDiv = document.getElementById('forgot-error');
    errDiv.classList.add('hidden');

    try {
        await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email })
        });
        pendingEmail = email;
        showAuthForm('reset');
        showToast('If this email exists, a code has been sent.');
    } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
    }
}

async function handleResetPassword() {
    const code = document.getElementById('reset-code').value.trim();
    const newPassword = document.getElementById('reset-password').value;
    const errDiv = document.getElementById('reset-error');
    errDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email: pendingEmail, code, new_password: newPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Failed to reset password.');

        showToast('Password updated! Please log in.');
        showAuthForm('login');
        document.getElementById('login-email').value = pendingEmail;
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
    // Avatar letter + popover
    const letter = currentUser.email ? currentUser.email[0].toUpperCase() : '?';
    const avatarEl = document.getElementById('user-avatar-letter');
    if (avatarEl) avatarEl.textContent = letter;
    const popoverEl = document.getElementById('email-popover');
    if (popoverEl) popoverEl.textContent = currentUser.email;
    // Sync nav currency dropdown
    const navCurrency = document.getElementById('nav-currency');
    if (navCurrency) navCurrency.value = currentUser.currency;
}

function toggleEmailPopover() {
    const popover = document.getElementById('email-popover');
    if (!popover) return;
    popover.classList.toggle('hidden');
    if (!popover.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', function closePopover(e) {
                if (!e.target.closest('.user-avatar-wrap')) {
                    popover.classList.add('hidden');
                }
                document.removeEventListener('click', closePopover);
            });
        }, 0);
    }
}

// Currency switcher — updates display labels across the whole page
async function handleCurrencyChange(newCurrency) {
    if (!currentUser) return;
    currentUser.currency = newCurrency;

    // Update donut chart label
    document.getElementById('user-currency-lbl').textContent = newCurrency;

    // Try to persist to backend (non-critical — ignore errors)
    try {
        await fetch(`${API_BASE}/auth/me`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ currency: newCurrency })
        });
    } catch (_) {}

    // Reload analytics so forecast values reflect new currency
    await loadAnalytics();
    // Re-render subscription list so sub-cost currency label updates
    renderSubscriptionsList();
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
                ${t('no_subs')}
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    subscriptionsList.forEach(sub => {
                const nextDate = new Date(sub.next_payment_date);
                nextDate.setHours(0, 0, 0, 0);

                // Calculate days remaining
                const diffTime = nextDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let statusBadgeHtml = '';
                if (sub.is_active) {
                    if (diffDays < 0) {
                        statusBadgeHtml = `<span class="badge badge-overdue">${t('overdue')} (${Math.abs(diffDays)}${t('days')})</span>`;
                    } else if (diffDays <= 2) {
                        statusBadgeHtml = `<span class="badge badge-soon">${t('due_in')} ${diffDays}${t('days')}</span>`;
                    }
                }

                const categoryName = sub.category ? sub.category.name : 'General';
                const cardClass = sub.is_active ? 'sub-row card' : 'sub-row card inactive';
                const displayCurrency = (currentUser && currentUser.currency) ? currentUser.currency : sub.currency;

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
                            Next: ${formatDate(sub.next_payment_date)}
                            ${statusBadgeHtml}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="sub-actions-container">
                <div class="sub-pricing">
                    <span class="sub-cost">${sub.amount} ${displayCurrency}</span>
                    <span class="sub-freq">/ ${sub.billing_period}</span>
                </div>
                <div class="sub-actions">
                    ${sub.is_active ? `
                        ${sub.is_paid ? `<span class="badge badge-paid">Paid</span>` : `<button class="action-icon-btn btn-pay" title="Mark as Paid" onclick="paySubscription(${sub.id})">✓ Paid</button>`}
                    ` : ''}
                    <button class="action-icon-btn btn-edit" title="Edit" onclick="editSubscription(${sub.id})"><img src="/static/icons/edit.svg" alt="Edit" class="icon"></button>
                    <button class="action-icon-btn btn-delete" title="Delete" onclick="deleteSubscription(${sub.id})"><img src="/static/icons/bin.svg" alt="Delete" class="icon"></button>
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
        
        showToast(t('toast_paid'));
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
        
        showToast(t('toast_deleted'));
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

    // Use currentUser.currency so the nav switcher controls the label everywhere
    const displayCurrency = (currentUser && currentUser.currency) ? currentUser.currency : analytics.currency;

    // 1. Update forecasts
    document.getElementById('forecast-30').textContent = `${analytics.forecast.forecast_30} ${displayCurrency}`;
    document.getElementById('forecast-90').textContent = `${analytics.forecast.forecast_90} ${displayCurrency}`;
    document.getElementById('forecast-365').textContent = `${analytics.forecast.forecast_365} ${displayCurrency}`;

    // 2. Render SVG Donut and Legend
    renderSpendChart(analytics.current_month_spend, displayCurrency);
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
    const todayIso = new Date().toISOString().substring(0, 10);
    const dateField = document.getElementById('sub-date');
    // Reset date field to today
    dateField.removeAttribute('data-iso');
    if (currentLang === 'ru') {
        const [y, m, d] = todayIso.split('-');
        dateField.value = `${d}.${m}.${y}`;
        dateField.setAttribute('data-iso', todayIso);
    } else {
        dateField.value = todayIso;
    }

    if (subToEdit) {
        title.textContent = t('edit_subscription_title');
        document.getElementById('sub-id').value = subToEdit.id;
        document.getElementById('sub-title').value = subToEdit.title;
        document.getElementById('sub-amount').value = subToEdit.amount;
        document.getElementById('sub-period').value = subToEdit.billing_period;
        const isoDate = subToEdit.next_payment_date;
        if (currentLang === 'ru') {
            const [y, m, d] = isoDate.split('-');
            dateField.value = `${d}.${m}.${y}`;
            dateField.setAttribute('data-iso', isoDate);
        } else {
            dateField.value = isoDate;
        }
        document.getElementById('sub-category').value = subToEdit.category_id || '';
        document.getElementById('sub-active').checked = subToEdit.is_active;
    } else {
        title.textContent = t('add_subscription_title');
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
    const billing_period = document.getElementById('sub-period').value;
    const dateField = document.getElementById('sub-date');
    const next_payment_date = dateField.getAttribute('data-mode') === 'ru'
        ? dateField.getAttribute('data-iso') || ''
        : dateField.value;
    const category_id = document.getElementById('sub-category').value ? parseInt(document.getElementById('sub-category').value) : null;
    const is_active = document.getElementById('sub-active').checked;
    const errDiv = document.getElementById('modal-error');

    const subData = {
        title,
        amount,
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
            let message = t('err_save_sub');
            try {
                const data = await response.json();
                const detail = data.detail;
                if (Array.isArray(detail)) {
                    const raw = detail.map(e => e.msg).join(', ');
                    // Replace Pydantic's technical messages with user-friendly ones
                    if (raw.toLowerCase().includes('less than')) {
                        message = t('err_amount_too_large');
                    } else {
                        message = raw;
                    }
                } else {
                    message = detail || message;
                }
            } catch (_) {
                message = response.status === 500
                    ? t('err_server')
                    : `${t('err_generic')} ${response.status}`;
            }
            throw new Error(message);
        }

        closeSubscriptionModal();
        showToast(id ? t('toast_updated') : t('toast_added'));
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

// Format date as "dd month yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

// Utility: escape HTML to prevent injection
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
}

// Format date as "dd month yyyy"
