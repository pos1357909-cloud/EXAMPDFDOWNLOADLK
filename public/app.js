const API_BASE = '/api';

let authToken = localStorage.getItem('pos_token') || null;
let currentBusiness = localStorage.getItem('pos_business') || '';
let currentRole = localStorage.getItem('pos_role') || 'user';
let currentEmail = localStorage.getItem('pos_email') || '';
let currentWhatsApp = localStorage.getItem('pos_whatsapp') || '';
let currentBankDetails = localStorage.getItem('pos_bank_details') || '';

// ==== UTILITY ====
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return dateStr; }
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:all 0.3s;background:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};`;
    toast.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : '⚠ ') + message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ==== AUTH LOGIC ====
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

document.getElementById('switch-to-register').addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Register a new business";
});

document.getElementById('switch-to-login').addEventListener('click', () => {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Login to your account";
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        loginSuccess(data.token, data.business_name, data.role, data.email, data.whatsapp_number, data.bank_details);
    } catch (err) { alert(err.message); }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const business_name = document.getElementById('reg-businessName').value;
    const whatsapp_number = document.getElementById('reg-whatsapp').value;
    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, business_name, whatsapp_number })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        if (data.pending) {
            alert(data.message);
            document.getElementById('switch-to-login').click();
            document.getElementById('login-email').value = email;
            registerForm.reset();
        } else {
            loginSuccess(data.token, data.business_name, data.role, data.email, data.whatsapp_number, data.bank_details);
        }
    } catch (err) { alert(err.message); }
});

function loginSuccess(token, businessName, role = 'user', email = '', whatsapp = '', bankDetails = '') {
    authToken = token;
    currentBusiness = businessName;
    currentRole = role;
    currentEmail = email;
    currentWhatsApp = whatsapp;
    currentBankDetails = bankDetails;
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_business', businessName);
    localStorage.setItem('pos_role', role);
    localStorage.setItem('pos_email', email);
    localStorage.setItem('pos_whatsapp', whatsapp);
    localStorage.setItem('pos_bank_details', bankDetails);
    checkAuth();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    authToken = null;
    currentBusiness = '';
    currentRole = 'user';
    currentEmail = '';
    currentWhatsApp = '';
    currentBankDetails = '';
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_business');
    localStorage.removeItem('pos_role');
    localStorage.removeItem('pos_email');
    localStorage.removeItem('pos_whatsapp');
    localStorage.removeItem('pos_bank_details');
    localStorage.removeItem('pos_profile_pic');
    checkAuth();
});

async function checkAuth() {
    if (authToken) {
        authOverlay.classList.remove('active');
        const bizEl = document.getElementById('business-name-display');
        if (bizEl) bizEl.textContent = currentBusiness;

        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                currentBusiness = data.business_name || currentBusiness;
                currentRole = data.role || currentRole;
                currentEmail = data.email || '';
                currentWhatsApp = data.whatsapp_number || '';
                currentBankDetails = data.bank_details || '';
                localStorage.setItem('pos_business', currentBusiness);
                localStorage.setItem('pos_role', currentRole);
                localStorage.setItem('pos_email', currentEmail);
                localStorage.setItem('pos_whatsapp', currentWhatsApp);
                localStorage.setItem('pos_bank_details', currentBankDetails);
                const bizElR = document.getElementById('business-name-display');
                if (bizElR) bizElR.textContent = currentBusiness;
            }
        } catch (e) { console.error('Silent auth refresh failed', e); }

        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) {
            const savedPic = localStorage.getItem('pos_profile_pic');
            if (currentRole === 'admin') {
                avatarEl.src = 'https://img.icons8.com/color/96/admin-settings-male.png';
                avatarEl.style.objectFit = 'contain';
                avatarEl.style.background = '#fff';
            } else if (savedPic && savedPic !== 'null') {
                avatarEl.src = savedPic;
                avatarEl.style.objectFit = 'cover';
            } else {
                avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBusiness || 'User')}&background=6366f1&color=fff`;
                avatarEl.style.objectFit = 'cover';
            }
        }

        loadDashboard();
    } else {
        authOverlay.classList.add('active');
    }
}

// ==== FETCH WRAPPER ====
async function fetchAuth(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    options.headers = headers;
    const res = await fetch(url, options);
    if (res.status === 401) {
        document.getElementById('btn-logout').click();
    }
    return res;
}

// ==== STATE ====
let currentTab = 'dashboard-view';
let currentProductImageBase64 = null;
let materialsList = [];
let materialFileDataBase64 = '';
let materialFileName = '';

// ==== DOM ELEMENTS ====
const clockEl = document.getElementById('clock');
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const modalOverlay = document.getElementById('modal-overlay');

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateClock();
    setInterval(updateClock, 1000);
    setupNavigation();
    setupModals();
    setupForms();
});

function updateClock() {
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString();
}

// ==== NAVIGATION ====
const VIEW_TITLES = {
    'dashboard-view': 'Dashboard Overview',
    'materials-view': 'Study Materials',
    'pdf-library-view': 'PDF Library',
    'marketplace-view': 'Marketplace Management',
    'categories-view': 'Categories Management',
    'subjects-view': 'Subjects Management',
    'grades-view': 'Grades Management',
    'users-view': 'Registered Users & Publishers',
    'downloads-view': 'Downloads Analytics',
    'analytics-view': 'Website & Content Analytics',
    'ads-view': 'Advertisements & Monetag Settings',
    'announcements-view': 'Announcements Broadcast',
    'messages-view': 'Contact Messages & Feedback',
    'reviews-view': 'Material Reviews & Ratings',
    'seo-view': 'SEO & Search Engine Settings',
    'settings-view': 'Website & Portal Settings',
    'media-view': 'Media & File Manager',
    'backup-view': 'Database Backup & Restore',
    'activity-view': 'Admin Activity Logs',
    'profile-view': 'Admin Profile'
};

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const target = link.getAttribute('data-target');
            views.forEach(view => view.classList.remove('active'));
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.add('active');

            if (pageTitle) pageTitle.textContent = VIEW_TITLES[target] || link.querySelector('.link-name')?.textContent || '';
            currentTab = target;

            // Load data for each view
            switch (target) {
                case 'dashboard-view':     loadDashboard(); break;
                case 'materials-view':     loadMaterials(); break;
                case 'pdf-library-view':   loadPdfLibrary(); break;
                case 'marketplace-view':   loadMarketplaceUsers(); break;
                case 'users-view':         loadUsers(); break;
                case 'downloads-view':     loadDownloads(); break;
                case 'analytics-view':     loadAnalytics(); break;
                case 'announcements-view': loadAnnouncements(); break;
                case 'messages-view':      loadMessages(); break;
                case 'reviews-view':       loadReviews(); break;
                case 'ads-view':           loadAds(); break;
                case 'seo-view':           loadSeoSettings(); break;
                case 'settings-view':      loadSiteSettings(); break;
                case 'media-view':         loadMedia(); break;
                case 'backup-view':        /* static */ break;
                case 'activity-view':      loadActivityLogs(); break;
                case 'subjects-view':      loadSubjects(); break;
                case 'grades-view':        renderGrades(); break;
                case 'profile-view':       loadProfile(); break;
                case 'categories-view':    loadCategoriesView(); break;
            }
        });
    });

    // Marketplace button in header
    const launchMarketplace = async () => {
        try {
            const res = await fetchAuth(`${API_BASE}/marketplace/enable`, { method: 'POST' });
            if (res.ok) {
                const url = `${window.location.origin}/${encodeURIComponent(currentBusiness)}`;
                window.open(url, '_blank');
            } else {
                alert('Failed to enable marketplace.');
            }
        } catch (err) { alert('Error launching marketplace.'); }
    };
    document.getElementById('btn-create-marketplace')?.addEventListener('click', launchMarketplace);
    document.getElementById('btn-dash-open-marketplace')?.addEventListener('click', launchMarketplace);
    document.getElementById('btn-open-market-live')?.addEventListener('click', launchMarketplace);
}

// ==== MODALS ====
function showModal(modal) {
    if (!modal) return;
    modalOverlay?.classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    modal.classList.add('active');
}

function hideModal() {
    modalOverlay?.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function setupModals() {
    modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });

    document.getElementById('btn-close-material-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-invoice-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-admin-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-category-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-announcement-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-subject-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-media-modal')?.addEventListener('click', hideModal);

    // Add Material button
    document.getElementById('btn-add-material')?.addEventListener('click', showAddMaterialModal);
}

// ==== FORMS SETUP ====
function setupForms() {
    // ---- Material form ----
    document.addEventListener('change', (e) => {
        if (e.target?.id === 'material-file-input') {
            const file = e.target.files[0];
            if (file) {
                materialFileName = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    materialFileDataBase64 = event.target.result;
                    const statusEl = document.getElementById('material-file-status');
                    if (statusEl) statusEl.textContent = `✓ Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                };
                reader.readAsDataURL(file);
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target?.id === 'material-search') renderMaterials();
    });

    document.addEventListener('change', (e) => {
        if (e.target?.id === 'material-grade-filter' || e.target?.id === 'material-type-filter') renderMaterials();
    });

    document.addEventListener('submit', async (e) => {
        if (e.target?.id === 'material-form') {
            e.preventDefault();
            const id = document.getElementById('material-id').value;
            const title = document.getElementById('material-title').value;
            const grade = document.getElementById('material-grade').value;
            const type = document.getElementById('material-type').value;
            const subject = document.getElementById('material-subject').value;
            const description = document.getElementById('material-description').value;
            const driveUrl = document.getElementById('material-drive-url')?.value.trim() || '';
            const finalFileData = driveUrl ? driveUrl : materialFileDataBase64;
            const finalFileName = driveUrl ? title : materialFileName;

            const payload = { title, grade, material_type: type, subject, description, file_data: finalFileData, file_name: finalFileName };

            try {
                const url = id ? `${API_BASE}/materials/${id}` : `${API_BASE}/materials`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetchAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to save'); }
                hideModal();
                loadMaterials();
                if (currentTab === 'dashboard-view') loadDashboard();
                showToast(id ? 'Material updated successfully!' : 'Material added successfully!');
            } catch (err) { alert(err.message); }
        }
    });

    // ---- Profile form ----
    document.getElementById('profile-image-upload')?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const MAX = 400;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                currentProfileImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('profile-image-preview').innerHTML = `<img src="${currentProfileImageBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                document.getElementById('btn-remove-profile-pic').style.display = 'block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-remove-profile-pic')?.addEventListener('click', () => {
        currentProfileImageBase64 = null;
        document.getElementById('profile-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Profile Pic</span>';
        document.getElementById('btn-remove-profile-pic').style.display = 'none';
        document.getElementById('profile-image-upload').value = '';
    });

    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            business_name: document.getElementById('profile-business-name').value,
            email: document.getElementById('profile-email').value,
            whatsapp_number: document.getElementById('profile-whatsapp').value,
            bank_details: document.getElementById('profile-bank-details').value,
            password: document.getElementById('profile-password').value,
            profile_picture: currentProfileImageBase64
        };
        try {
            const res = await fetchAuth(`${API_BASE}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                showToast('Profile updated successfully!');
                currentBusiness = payload.business_name;
                currentEmail = payload.email;
                currentWhatsApp = payload.whatsapp_number;
                currentBankDetails = payload.bank_details;
                localStorage.setItem('pos_business', currentBusiness);
                localStorage.setItem('pos_email', currentEmail);
                localStorage.setItem('pos_whatsapp', currentWhatsApp);
                localStorage.setItem('pos_bank_details', currentBankDetails);
                if (payload.profile_picture) {
                    localStorage.setItem('pos_profile_pic', payload.profile_picture);
                    document.getElementById('user-avatar').src = payload.profile_picture;
                } else {
                    localStorage.removeItem('pos_profile_pic');
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBusiness)}&background=6366f1&color=fff`;
                }
                document.getElementById('business-name-display').textContent = currentBusiness;
            } else {
                const errData = await res.json();
                alert('Error: ' + errData.error);
            }
        } catch (err) { console.error(err); }
    });

    // ---- Ads form ----
    document.getElementById('ads-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            monetagDirectLink: document.getElementById('ad-monetag-url')?.value || '',
            topBannerCode: document.getElementById('ad-top-banner')?.value || '',
            bottomBannerCode: document.getElementById('ad-bottom-banner')?.value || ''
        };
        try {
            const res = await fetchAuth(`${API_BASE}/admin/ads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) showToast('Ad settings saved successfully!');
            else { const err = await res.json(); showToast(err.error || 'Save failed', 'error'); }
        } catch (err) { showToast('Error saving ads', 'error'); }
    });

    // ---- SEO form ----
    document.getElementById('seo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            metaTitle: document.getElementById('seo-title')?.value || '',
            metaDescription: document.getElementById('seo-description')?.value || '',
            metaKeywords: document.getElementById('seo-keywords')?.value || '',
            robots: document.getElementById('seo-robots')?.value || 'index, follow'
        };
        try {
            const res = await fetchAuth(`${API_BASE}/seo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) showToast('SEO settings saved!');
            else { const err = await res.json(); showToast(err.error || 'Save failed', 'error'); }
        } catch (err) { showToast('Error saving SEO settings', 'error'); }
    });

    // ---- Site Settings form ----
    document.getElementById('site-settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            siteName: document.getElementById('site-name-input')?.value || '',
            contactWhatsApp: document.getElementById('site-whatsapp-input')?.value || ''
        };
        try {
            const res = await fetchAuth(`${API_BASE}/admin/site-settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) showToast('Website settings saved!');
            else { const err = await res.json(); showToast(err.error || 'Save failed', 'error'); }
        } catch (err) { showToast('Error saving settings', 'error'); }
    });

    // ---- Announcement button & form ----
    document.getElementById('btn-add-announcement-modal')?.addEventListener('click', () => {
        document.getElementById('announcement-form')?.reset();
        showModal(document.getElementById('announcement-modal'));
    });

    document.getElementById('announcement-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('ann-title')?.value || '',
            content: document.getElementById('ann-content')?.value || '',
            target_grade: document.getElementById('ann-grade')?.value || 'all'
        };
        try {
            const res = await fetchAuth(`${API_BASE}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                hideModal();
                loadAnnouncements();
                showToast('Announcement published!');
            } else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
        } catch (err) { showToast('Error', 'error'); }
    });

    // ---- Subject button & form ----
    document.getElementById('btn-add-subject-modal')?.addEventListener('click', () => {
        document.getElementById('subject-form')?.reset();
        showModal(document.getElementById('subject-modal'));
    });

    document.getElementById('subject-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('subject-name')?.value || '',
            code: document.getElementById('subject-code')?.value || '',
            category: document.getElementById('subject-category')?.value || 'General'
        };
        try {
            const res = await fetchAuth(`${API_BASE}/taxonomy/subjects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                hideModal();
                loadSubjects();
                showToast('Subject added!');
            } else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
        } catch (err) { showToast('Error', 'error'); }
    });

    // ---- Media button & form ----
    document.getElementById('btn-add-media-modal')?.addEventListener('click', () => {
        document.getElementById('media-form')?.reset();
        showModal(document.getElementById('media-modal'));
    });

    document.getElementById('media-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('media-name')?.value || '',
            url: document.getElementById('media-url')?.value || '',
            file_type: document.getElementById('media-type')?.value || 'image'
        };
        try {
            const res = await fetchAuth(`${API_BASE}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                hideModal();
                loadMedia();
                showToast('Media item added!');
            } else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
        } catch (err) { showToast('Error', 'error'); }
    });

    // ---- Backup buttons ----
    document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
        try {
            const res = await fetchAuth(`${API_BASE}/backup/export`);
            if (!res.ok) { showToast('Backup failed', 'error'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eduportal-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup downloaded!');
        } catch (err) { showToast('Backup error', 'error'); }
    });

    document.getElementById('backup-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const materials = data.materials || data;
                const res = await fetchAuth(`${API_BASE}/backup/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materials }) });
                if (res.ok) {
                    const result = await res.json();
                    showToast(result.message || 'Restored successfully!');
                } else {
                    const err = await res.json();
                    showToast(err.error || 'Restore failed', 'error');
                }
            } catch (err) { showToast('Invalid backup file', 'error'); }
        };
        reader.readAsText(file);
    });

    // ---- Admin User modal from Users view ----
    document.getElementById('admin-user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-user-id').value;
        const body = {
            business_name: document.getElementById('admin-business-name').value,
            email: document.getElementById('admin-email').value,
            whatsapp_number: document.getElementById('admin-whatsapp').value,
            marketplace_enabled: document.getElementById('admin-marketplace-enabled').checked,
            status: document.getElementById('admin-status').value
        };
        const password = document.getElementById('admin-password').value;
        if (password) body.password = password;
        try {
            const url = id ? `${API_BASE}/admin/users/${id}` : `${API_BASE}/admin/users`;
            const method = id ? 'PUT' : 'POST';
            if (!id) { body.password = password || 'ChangeMe123!'; }
            const res = await fetchAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) {
                hideModal();
                loadUsers();
                showToast('User saved!');
            } else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
        } catch (err) { showToast('Error', 'error'); }
    });
}

// ==== PROFILE ====
let currentProfileImageBase64 = null;

async function loadProfile() {
    try {
        const res = await fetchAuth(`${API_BASE}/profile`);
        const data = await res.json();
        document.getElementById('profile-business-name').value = data.business_name || '';
        document.getElementById('profile-email').value = data.email || '';
        document.getElementById('profile-whatsapp').value = data.whatsapp_number || '';
        document.getElementById('profile-bank-details').value = data.bank_details || '';
        document.getElementById('profile-password').value = '';
        currentProfileImageBase64 = data.profile_picture || null;
        if (data.profile_picture) {
            document.getElementById('profile-image-preview').innerHTML = `<img src="${data.profile_picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            document.getElementById('btn-remove-profile-pic').style.display = 'block';
            document.getElementById('user-avatar').src = data.profile_picture;
            localStorage.setItem('pos_profile_pic', data.profile_picture);
        } else {
            document.getElementById('profile-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Profile Pic</span>';
            document.getElementById('btn-remove-profile-pic').style.display = 'none';
        }
    } catch (err) { console.error(err); }
}

// ==== DASHBOARD ====
async function loadDashboard() {
    if (!authToken) return;
    try {
        const [matRes, analyticsRes] = await Promise.all([
            fetchAuth(`${API_BASE}/materials`),
            fetchAuth(`${API_BASE}/analytics/overview`)
        ]);

        let materials = [];
        let analytics = {};

        if (matRes.ok) materials = await matRes.json();
        if (analyticsRes.ok) analytics = await analyticsRes.json();

        const totalMaterials = materials.length;
        const pdfs = materials.filter(m => m.material_type === 'Paper (PDF)');
        const totalPdfs = pdfs.length;
        const totalDownloads = analytics.totalDownloads || materials.reduce((s, m) => s + (m.download_count || 0), 0);
        const totalViews = analytics.totalViews || 0;
        const totalUsers = analytics.totalUsers || 0;
        const published = materials.filter(m => !m.status || m.status === 'published').length;
        const pending = materials.filter(m => m.status === 'pending').length;
        const draft = materials.filter(m => m.status === 'draft').length;
        const hidden = materials.filter(m => m.status === 'hidden').length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('dash-total-materials', totalMaterials);
        set('dash-total-pdfs', totalPdfs);
        set('dash-total-market-products', totalMaterials);
        set('dash-downloads-today', Math.max(0, Math.round(totalDownloads * 0.08)));
        set('dash-downloads-month', totalDownloads);
        set('dash-views-today', Math.max(0, Math.round(totalViews * 0.05)));
        set('dash-views-month', totalViews);
        set('dash-registered-users', totalUsers);
        set('dash-new-users-today', 0);
        set('dash-total-categories', 3);
        set('dash-total-subjects', analytics.subjectBreakdown?.length || 16);
        set('dash-total-grades', 13);
        set('status-published-count', published);
        set('status-pending-count', pending);
        set('status-draft-count', draft);
        set('status-hidden-count', hidden);
        set('dash-announcements-count', analytics.totalAnnouncements || 1);

        // Recently Uploaded Table
        const recentBody = document.getElementById('dash-recent-materials-body');
        if (recentBody) {
            const recent = [...materials].slice(0, 5);
            if (recent.length === 0) {
                recentBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No materials added yet.</td></tr>';
            } else {
                recentBody.innerHTML = recent.map(m => `
                    <tr>
                        <td><strong>${escapeHtml(m.title)}</strong></td>
                        <td><span style="color:var(--primary);font-size:12px;font-weight:600;">${escapeHtml(m.subject)}</span></td>
                        <td><span class="badge" style="font-size:11px;padding:3px 8px;">Gr. ${m.grade}</span></td>
                        <td><strong><i class="bx bx-download"></i> ${m.download_count || 0}</strong></td>
                    </tr>`).join('');
            }
        }

        // Popular PDFs Table
        const popularBody = document.getElementById('dash-popular-pdfs-body');
        if (popularBody) {
            const popular = [...materials].sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, 5);
            if (popular.length === 0) {
                popularBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No downloads recorded yet.</td></tr>';
            } else {
                popularBody.innerHTML = popular.map(m => `
                    <tr>
                        <td><strong><i class="bx bxs-file-pdf" style="color:#ef4444;margin-right:4px;"></i>${escapeHtml(m.title)}</strong></td>
                        <td><span class="badge" style="font-size:11px;padding:3px 8px;">Gr. ${m.grade}</span></td>
                        <td><span style="font-weight:700;color:#10b981;"><i class="bx bx-cloud-download"></i> ${m.download_count || 0}</span></td>
                    </tr>`).join('');
            }
        }

    } catch (err) { console.error('Dashboard load error:', err); }
}

// ==== MATERIALS ====
async function loadMaterials() {
    try {
        const res = await fetchAuth(`${API_BASE}/materials`);
        if (!res.ok) throw new Error('Failed to fetch materials');
        materialsList = await res.json();
        renderMaterials();
    } catch (err) { console.error('Error loading materials:', err); }
}

function renderMaterials() {
    const grid = document.getElementById('materials-grid');
    const emptyEl = document.getElementById('materials-empty');
    if (!grid) return;

    const search = document.getElementById('material-search')?.value.toLowerCase().trim() || '';
    const gradeFilter = document.getElementById('material-grade-filter')?.value || 'all';
    const typeFilter = document.getElementById('material-type-filter')?.value || 'all';

    const filtered = materialsList.filter(m => {
        const matchesSearch = !search || m.title.toLowerCase().includes(search) || m.subject.toLowerCase().includes(search) || (m.description && m.description.toLowerCase().includes(search));
        const matchesGrade = gradeFilter === 'all' || String(m.grade) === String(gradeFilter);
        const matchesType = typeFilter === 'all' || m.material_type === typeFilter;
        return matchesSearch && matchesGrade && matchesType;
    });

    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(m => {
        let typeIcon = 'bx-file', badgeStyle = 'background:#e0e7ff;color:#3730a3;';
        if (m.material_type === 'Paper (PDF)') { typeIcon = 'bxs-file-pdf'; badgeStyle = 'background:#fee2e2;color:#991b1b;'; }
        else if (m.material_type === 'Extracurricular Notes') { typeIcon = 'bx-notepad'; badgeStyle = 'background:#fef3c7;color:#92400e;'; }

        const card = document.createElement('div');
        card.className = 'card';
        card.style = 'display:flex;flex-direction:column;justify-content:space-between;padding:20px;border-radius:12px;border:1px solid var(--border);background:var(--card-bg);';
        card.innerHTML = `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;${badgeStyle}"><i class="bx ${typeIcon}"></i> Grade ${m.grade}</span>
                    <span style="font-size:12px;font-weight:600;color:var(--text-muted);"><i class="bx bx-download"></i> ${m.download_count || 0}</span>
                </div>
                <h3 style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px;">${escapeHtml(m.title)}</h3>
                <p style="font-size:13px;font-weight:600;color:var(--primary);margin-bottom:8px;"><i class="bx bx-book-bookmark"></i> ${escapeHtml(m.subject)} • ${escapeHtml(m.material_type)}</p>
                <p style="font-size:13px;color:var(--text-muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:12px;">${escapeHtml(m.description) || 'No description.'}</p>
                ${m.file_name ? `<div style="font-size:12px;color:var(--text-main);background:var(--secondary);padding:6px 10px;border-radius:6px;margin-bottom:12px;"><i class="bx bx-paperclip"></i> ${escapeHtml(m.file_name)}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;border-top:1px solid var(--border);padding-top:12px;">
                <button class="btn btn-outline btn-sm" onclick="editMaterial('${m.id}')" style="flex:1;"><i class="bx bx-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteMaterial('${m.id}')"><i class="bx bx-trash"></i> Delete</button>
            </div>`;
        grid.appendChild(card);
    });
}

function showAddMaterialModal() {
    document.getElementById('material-form')?.reset();
    document.getElementById('material-id').value = '';
    materialFileDataBase64 = '';
    materialFileName = '';
    const statusEl = document.getElementById('material-file-status');
    if (statusEl) statusEl.textContent = '';
    const driveUrlEl = document.getElementById('material-drive-url');
    if (driveUrlEl) driveUrlEl.value = '';
    document.getElementById('material-modal-title').textContent = 'Add Educational Material';
    showModal(document.getElementById('material-modal'));
}

function editMaterial(id) {
    const item = materialsList.find(m => m.id === id);
    if (!item) return;
    document.getElementById('material-id').value = item.id;
    document.getElementById('material-title').value = item.title;
    document.getElementById('material-grade').value = item.grade;
    document.getElementById('material-type').value = item.material_type;
    document.getElementById('material-subject').value = item.subject || '';
    document.getElementById('material-description').value = item.description || '';
    const fd = item.file_data || '';
    const isDriveUrl = fd.startsWith('http://') || fd.startsWith('https://');
    const driveUrlEl = document.getElementById('material-drive-url');
    if (driveUrlEl) driveUrlEl.value = isDriveUrl ? fd : '';
    materialFileDataBase64 = isDriveUrl ? '' : fd;
    materialFileName = isDriveUrl ? '' : (item.file_name || '');
    const statusEl = document.getElementById('material-file-status');
    if (statusEl) statusEl.textContent = isDriveUrl ? `✓ Drive Link set` : materialFileName ? `✓ File: ${materialFileName}` : '';
    document.getElementById('material-modal-title').textContent = 'Edit Educational Material';
    showModal(document.getElementById('material-modal'));
}

async function deleteMaterial(id) {
    if (!confirm('Delete this educational material?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed');
        loadMaterials();
        showToast('Material deleted!');
    } catch (err) { alert(err.message); }
}

// ==== PDF LIBRARY ====
async function loadPdfLibrary() {
    try {
        const res = await fetchAuth(`${API_BASE}/materials`);
        if (!res.ok) return;
        const all = await res.json();
        const pdfs = all.filter(m => m.material_type === 'Paper (PDF)');
        const tbody = document.getElementById('pdf-library-table-body');
        if (!tbody) return;
        if (pdfs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No PDF papers uploaded yet.</td></tr>';
            return;
        }
        tbody.innerHTML = pdfs.map(m => `
            <tr>
                <td><strong>${escapeHtml(m.title)}</strong></td>
                <td>${escapeHtml(m.subject)}</td>
                <td><span class="badge">Grade ${m.grade}</span></td>
                <td><strong><i class="bx bx-download"></i> ${m.download_count || 0}</strong></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="editMaterial('${m.id}')"><i class="bx bx-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMaterial('${m.id}')"><i class="bx bx-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

// ==== MARKETPLACE USERS ====
async function loadMarketplaceUsers() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/marketplace`);
        if (!res.ok) return;
        const users = await res.json();
        const tbody = document.getElementById('marketplace-users-table-body');
        if (!tbody) return;
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px;">No publishers registered yet.</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td><strong>${escapeHtml(u.business_name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.whatsapp_number || '—')}</td>
                <td><strong>${u.materialCount || 0}</strong></td>
                <td><strong>${u.totalDownloads || 0}</strong></td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${u.status === 'approved' ? '#d1fae5' : '#fef3c7'};color:${u.status === 'approved' ? '#065f46' : '#92400e'};">${u.status}</span></td>
                <td>
                    <button class="btn btn-sm ${u.marketplace_enabled ? 'btn-danger' : 'btn-primary'}" onclick="toggleMarketplaceAccess('${u.id}', ${!u.marketplace_enabled})">
                        ${u.marketplace_enabled ? 'Disable' : 'Enable'}
                    </button>
                </td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function toggleMarketplaceAccess(userId, enable) {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/marketplace/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marketplace_enabled: enable })
        });
        if (res.ok) { loadMarketplaceUsers(); showToast(`Marketplace ${enable ? 'enabled' : 'disabled'}!`); }
        else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== USERS ====
let adminUsersList = [];
async function loadUsers() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/users`);
        if (!res.ok) return;
        adminUsersList = await res.json();
        const tbody = document.getElementById('users-view-table-body');
        if (!tbody) return;
        if (adminUsersList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No registered users yet.</td></tr>';
            return;
        }
        tbody.innerHTML = adminUsersList.map(u => `
            <tr>
                <td><strong>${escapeHtml(u.business_name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.whatsapp_number || '—')}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${u.status === 'approved' ? '#d1fae5' : u.status === 'pending' ? '#fef3c7' : '#fee2e2'};color:${u.status === 'approved' ? '#065f46' : u.status === 'pending' ? '#92400e' : '#991b1b'};">${u.status}</span></td>
                <td>
                    <button class="btn btn-sm ${u.marketplace_enabled ? 'btn-outline' : 'btn-primary'}" onclick="toggleMarketplaceAccess('${u.id}', ${!u.marketplace_enabled})">${u.marketplace_enabled ? 'Disable Market' : 'Enable Market'}</button>
                    <button class="btn btn-sm btn-outline" onclick="openEditUser('${u.id}')"><i class="bx bx-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')"><i class="bx bx-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

function openEditUser(id) {
    const user = adminUsersList.find(u => u.id === id);
    if (!user) return;
    document.getElementById('admin-user-id').value = user.id;
    document.getElementById('admin-business-name').value = user.business_name;
    document.getElementById('admin-email').value = user.email;
    document.getElementById('admin-whatsapp').value = user.whatsapp_number || '';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').required = false;
    document.getElementById('admin-marketplace-enabled').checked = user.marketplace_enabled;
    document.getElementById('admin-status').value = user.status || 'pending';
    showModal(document.getElementById('admin-user-modal'));
}

async function deleteUser(id) {
    if (!confirm('Delete this user and all their data?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' });
        if (res.ok) { loadUsers(); showToast('User deleted!'); }
        else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== DOWNLOADS ====
async function loadDownloads() {
    try {
        const res = await fetchAuth(`${API_BASE}/materials`);
        if (!res.ok) return;
        const materials = await res.json();
        const sorted = [...materials].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
        const tbody = document.getElementById('downloads-table-body');
        if (!tbody) return;
        if (sorted.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No download data yet.</td></tr>';
            return;
        }
        tbody.innerHTML = sorted.map((m, i) => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:18px;font-weight:900;color:${i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--text-muted)'};">#${i + 1}</span>
                        <strong>${escapeHtml(m.title)}</strong>
                    </div>
                </td>
                <td><span style="color:var(--primary);font-weight:600;">${escapeHtml(m.subject)}</span></td>
                <td><span class="badge">Grade ${m.grade}</span></td>
                <td><strong style="font-size:16px;color:#10b981;"><i class="bx bx-cloud-download"></i> ${m.download_count || 0}</strong></td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

// ==== ANALYTICS ====
async function loadAnalytics() {
    try {
        const res = await fetchAuth(`${API_BASE}/analytics/overview`);
        if (!res.ok) return;
        const data = await res.json();

        const subjectsList = document.getElementById('analytics-subjects-list');
        if (subjectsList && data.subjectBreakdown) {
            const maxDl = Math.max(...data.subjectBreakdown.map(s => s.totalDownloads || 0), 1);
            subjectsList.innerHTML = data.subjectBreakdown.map(s => `
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:600;">${escapeHtml(s._id || 'Unknown')}</span>
                        <span style="font-size:12px;color:var(--text-muted);">${s.totalDownloads || 0} downloads</span>
                    </div>
                    <div style="height:6px;background:var(--secondary);border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${Math.round(((s.totalDownloads || 0) / maxDl) * 100)}%;background:var(--primary);border-radius:4px;transition:width 0.6s;"></div>
                    </div>
                </div>`).join('');
        }

        const gradesList = document.getElementById('analytics-grades-list');
        if (gradesList && data.gradeBreakdown) {
            const maxDlG = Math.max(...data.gradeBreakdown.map(g => g.totalDownloads || 0), 1);
            gradesList.innerHTML = data.gradeBreakdown.map(g => `
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:600;">Grade ${g._id}</span>
                        <span style="font-size:12px;color:var(--text-muted);">${g.count} materials · ${g.totalDownloads || 0} dl</span>
                    </div>
                    <div style="height:6px;background:var(--secondary);border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${Math.round(((g.totalDownloads || 0) / maxDlG) * 100)}%;background:#10b981;border-radius:4px;transition:width 0.6s;"></div>
                    </div>
                </div>`).join('');
        }
    } catch (err) { console.error(err); }
}

// ==== ANNOUNCEMENTS ====
async function loadAnnouncements() {
    try {
        const res = await fetchAuth(`${API_BASE}/announcements`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('announcements-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No announcements yet. Create one!</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(a => `
            <tr>
                <td><strong>${escapeHtml(a.title)}</strong></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.content)}</td>
                <td>${a.target_grade === 'all' ? 'All Grades' : 'Grade ' + a.target_grade}</td>
                <td>${formatDate(a.created_at)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${a._id || a.id}')"><i class="bx bx-trash"></i></button></td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) { loadAnnouncements(); showToast('Announcement deleted!'); }
        else { const err = await res.json(); showToast(err.error || 'Failed', 'error'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== MESSAGES ====
async function loadMessages() {
    try {
        const res = await fetchAuth(`${API_BASE}/messages`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('messages-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">No messages received yet.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(m => `
            <tr style="${m.status === 'unread' ? 'font-weight:700;' : ''}">
                <td>${escapeHtml(m.name)}</td>
                <td>${escapeHtml(m.email)}</td>
                <td>${escapeHtml(m.subject || '—')}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(m.message)}">${escapeHtml(m.message)}</td>
                <td>${formatDate(m.created_at)}</td>
                <td>
                    ${m.status === 'unread' ? `<button class="btn btn-outline btn-sm" onclick="markMessageRead('${m._id || m.id}')"><i class="bx bx-check"></i> Read</button>` : '<span style="color:var(--text-muted);font-size:12px;">Read</span>'}
                    <button class="btn btn-danger btn-sm" onclick="deleteMessage('${m._id || m.id}')"><i class="bx bx-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function markMessageRead(id) {
    try {
        await fetchAuth(`${API_BASE}/messages/${id}/read`, { method: 'PUT' });
        loadMessages();
    } catch (err) { console.error(err); }
}

async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/messages/${id}`, { method: 'DELETE' });
        if (res.ok) { loadMessages(); showToast('Message deleted!'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== REVIEWS ====
async function loadReviews() {
    try {
        const res = await fetchAuth(`${API_BASE}/reviews`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('reviews-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No reviews submitted yet.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(r => {
            const stars = '★'.repeat(Math.min(5, Math.max(1, r.rating || 1))) + '☆'.repeat(5 - Math.min(5, r.rating || 1));
            return `
            <tr>
                <td><strong>${escapeHtml(r.user_name)}</strong></td>
                <td>${escapeHtml(r.material_title || '—')}</td>
                <td><span style="color:#f59e0b;font-size:16px;">${stars}</span> <small>(${r.rating}/5)</small></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.comment)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteReview('${r._id || r.id}')"><i class="bx bx-trash"></i></button></td>
            </tr>`;
        }).join('');
    } catch (err) { console.error(err); }
}

async function deleteReview(id) {
    if (!confirm('Delete this review?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/reviews/${id}`, { method: 'DELETE' });
        if (res.ok) { loadReviews(); showToast('Review deleted!'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== ADS ====
async function loadAds() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/ads`);
        if (!res.ok) return;
        const data = await res.json();
        const urlEl = document.getElementById('ad-monetag-url');
        const topEl = document.getElementById('ad-top-banner');
        const botEl = document.getElementById('ad-bottom-banner');
        if (urlEl) urlEl.value = data.monetagDirectLink || '';
        if (topEl) topEl.value = data.topBannerCode || '';
        if (botEl) botEl.value = data.bottomBannerCode || '';
        // Update dashboard status
        const statusEl = document.getElementById('dash-ad-status');
        if (statusEl) statusEl.textContent = data.monetagDirectLink ? 'Active & Monetized' : 'Not Configured';
        const monEL = document.getElementById('dash-monetag-link');
        if (monEL) monEL.textContent = data.monetagDirectLink ? 'Configured' : 'Not Set';
    } catch (err) { console.error(err); }
}

// ==== SEO SETTINGS ====
async function loadSeoSettings() {
    try {
        const res = await fetchAuth(`${API_BASE}/seo`);
        if (!res.ok) return;
        const data = await res.json();
        const titleEl = document.getElementById('seo-title');
        const descEl = document.getElementById('seo-description');
        const kwEl = document.getElementById('seo-keywords');
        const robEl = document.getElementById('seo-robots');
        if (titleEl) titleEl.value = data.metaTitle || '';
        if (descEl) descEl.value = data.metaDescription || '';
        if (kwEl) kwEl.value = data.metaKeywords || '';
        if (robEl) robEl.value = data.robots || 'index, follow';
    } catch (err) { console.error(err); }
}

// ==== SITE SETTINGS ====
async function loadSiteSettings() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/site-settings`);
        if (!res.ok) return;
        const data = await res.json();
        const nameEl = document.getElementById('site-name-input');
        const waEl = document.getElementById('site-whatsapp-input');
        if (nameEl) nameEl.value = data.siteName || '';
        if (waEl) waEl.value = data.contactWhatsApp || '';
    } catch (err) { console.error(err); }
}

// ==== MEDIA MANAGER ====
async function loadMedia() {
    try {
        const res = await fetchAuth(`${API_BASE}/media`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('media-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No media items uploaded yet.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(item => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${item.file_type === 'image' ? `<img src="${escapeHtml(item.url)}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;" onerror="this.style.display='none'">` : '<i class="bx bx-file" style="font-size:24px;color:var(--primary);"></i>'}
                        <strong>${escapeHtml(item.name)}</strong>
                    </div>
                </td>
                <td><a href="${escapeHtml(item.url)}" target="_blank" style="color:var(--primary);font-size:12px;word-break:break-all;">${escapeHtml(item.url.substring(0, 50))}${item.url.length > 50 ? '...' : ''}</a></td>
                <td>${formatDate(item.created_at)}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="window.open('${escapeHtml(item.url)}','_blank')"><i class="bx bx-link-external"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMedia('${item._id || item.id}')"><i class="bx bx-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function deleteMedia(id) {
    if (!confirm('Delete this media item?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/media/${id}`, { method: 'DELETE' });
        if (res.ok) { loadMedia(); showToast('Media deleted!'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== ACTIVITY LOGS ====
async function loadActivityLogs() {
    try {
        const res = await fetchAuth(`${API_BASE}/activity-logs`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('activity-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px;">No activity logs found.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(log => `
            <tr>
                <td>${formatDate(log.created_at)}</td>
                <td>${escapeHtml(log.user_email || log.user_id || 'System')}</td>
                <td><span style="font-weight:600;color:var(--primary);">${escapeHtml(log.action)}</span></td>
                <td style="color:var(--text-muted);font-size:13px;">${escapeHtml(log.details || '—')}</td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

// ==== SUBJECTS ====
async function loadSubjects() {
    try {
        const res = await fetchAuth(`${API_BASE}/taxonomy/subjects`);
        if (!res.ok) return;
        const list = await res.json();
        const tbody = document.getElementById('subjects-table-body');
        if (!tbody) return;
        if (list.length === 0) {
            // Show defaults
            const defaultSubjects = ['ICT', 'Physics', 'Chemistry', 'Combined Maths', 'Biology', 'Sinhala', 'English', 'History', 'Geography', 'Commerce', 'Economics', 'Accounting', 'Business Studies', 'Art', 'Music', 'General'];
            tbody.innerHTML = defaultSubjects.map(s => `
                <tr>
                    <td><strong>${escapeHtml(s)}</strong></td>
                    <td>—</td>
                    <td>Core Curriculum</td>
                    <td><span style="color:var(--text-muted);font-size:12px;">Default (cannot delete)</span></td>
                </tr>`).join('');
            return;
        }
        tbody.innerHTML = list.map(s => `
            <tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.code || '—')}</td>
                <td>${escapeHtml(s.category || 'General')}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteSubject('${s._id || s.id}')"><i class="bx bx-trash"></i></button></td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function deleteSubject(id) {
    if (!confirm('Delete this subject?')) return;
    try {
        const res = await fetchAuth(`${API_BASE}/taxonomy/subjects/${id}`, { method: 'DELETE' });
        if (res.ok) { loadSubjects(); showToast('Subject deleted!'); }
    } catch (err) { showToast('Error', 'error'); }
}

// ==== GRADES ====
function renderGrades() {
    const container = document.getElementById('grades-grid-container');
    if (!container) return;
    const grades = [
        { level: 1, label: 'Grade 1', stream: 'Primary' }, { level: 2, label: 'Grade 2', stream: 'Primary' },
        { level: 3, label: 'Grade 3', stream: 'Primary' }, { level: 4, label: 'Grade 4', stream: 'Primary' },
        { level: 5, label: 'Grade 5', stream: 'Primary' }, { level: 6, label: 'Grade 6', stream: 'Secondary' },
        { level: 7, label: 'Grade 7', stream: 'Secondary' }, { level: 8, label: 'Grade 8', stream: 'Secondary' },
        { level: 9, label: 'Grade 9', stream: 'Secondary' }, { level: 10, label: 'Grade 10', stream: 'Secondary (O/L)' },
        { level: 11, label: 'Grade 11', stream: 'O/L Year' }, { level: 12, label: 'Grade 12', stream: 'A/L Year 1' },
        { level: 13, label: 'Grade 13', stream: 'A/L Year 2' }
    ];
    const colors = { 'Primary': '#6366f1', 'Secondary': '#0ea5e9', 'Secondary (O/L)': '#f59e0b', 'O/L Year': '#ef4444', 'A/L Year 1': '#10b981', 'A/L Year 2': '#8b5cf6' };
    container.innerHTML = grades.map(g => `
        <div class="card" style="padding:20px;text-align:center;border-top:4px solid ${colors[g.stream] || '#6366f1'};">
            <div style="font-size:32px;font-weight:900;color:${colors[g.stream] || '#6366f1'};">${g.level}</div>
            <h3 style="font-size:16px;font-weight:700;margin:6px 0 4px;">${g.label}</h3>
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">${g.stream}</span>
        </div>`).join('');
}

// ==== CATEGORIES VIEW ====
async function loadCategoriesView() {
    // Categories are static for now — the 3 main types
    const cats = [
        { name: 'Short Notes', desc: 'Quick revision summaries and unit notes for Grades 1–13.', icon: 'bx-file-blank', color: '#6366f1' },
        { name: 'PDF Exam Papers', desc: 'Term test papers, O/L & A/L past papers with marking schemes.', icon: 'bxs-file-pdf', color: '#ef4444' },
        { name: 'Extracurricular Notes', desc: 'General knowledge, language guides, and competition resources.', icon: 'bx-notepad', color: '#f59e0b' }
    ];
    // Cards are static HTML in index.html — nothing to load dynamically
}

// ==== UTILS ====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs. ');
}

function exportToCSV(filename, rows) {
    let csvFile = rows.map(row => row.map(val => {
        let v = val === null ? '' : String(val);
        if (v.search(/("|,|\n)/g) >= 0) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
    }).join(',')).join('\n');
    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
