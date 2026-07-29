const API_BASE = '/api';

let authToken = localStorage.getItem('pos_token') || null;
let currentBusiness = localStorage.getItem('pos_business') || '';
let currentRole = localStorage.getItem('pos_role') || 'user';
let currentEmail = localStorage.getItem('pos_email') || '';
let currentWhatsApp = localStorage.getItem('pos_whatsapp') || '';
let currentBankDetails = localStorage.getItem('pos_bank_details') || '';

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
        if(!res.ok) throw new Error(data.error || 'Login failed');
        
        loginSuccess(data.token, data.business_name, data.role, data.email, data.whatsapp_number, data.bank_details);
    } catch(err) { alert(err.message); }
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
        
        if (!res.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        if (data.pending) {
            alert(data.message);
            document.getElementById('switch-to-login').click();
            document.getElementById('login-email').value = email;
            registerForm.reset();
        } else {
            loginSuccess(data.token, data.business_name, data.role, data.email, data.whatsapp_number, data.bank_details);
        }
    } catch(err) { alert(err.message); }
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
        document.getElementById('business-name-display').textContent = currentBusiness;
        
        // Attempt to fetch fresh details if missing or to verify role
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if(res.ok) {
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
                document.getElementById('business-name-display').textContent = currentBusiness;
            }
        } catch(e) { console.error('Silent auth refresh failed', e); }
        
        if (currentRole === 'admin') {
            document.getElementById('nav-item-admin').style.display = 'block';
            document.getElementById('nav-item-profile').style.display = 'none';
            document.getElementById('user-avatar').src = 'https://img.icons8.com/color/96/admin-settings-male.png';
            document.getElementById('user-avatar').style.objectFit = 'contain';
            document.getElementById('user-avatar').style.background = '#fff';
        } else {
            document.getElementById('nav-item-admin').style.display = 'none';
            document.getElementById('nav-item-profile').style.display = 'block';
            
            const savedPic = localStorage.getItem('pos_profile_pic');
            if (savedPic && savedPic !== 'null') {
                document.getElementById('user-avatar').src = savedPic;
            } else {
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBusiness || 'User')}&background=6366f1&color=fff`;
            }
            document.getElementById('user-avatar').style.objectFit = 'cover';
        }
        
        // Re-initialize data
        loadDashboard();
    } else {
        authOverlay.classList.add('active');
    }
}

// Wrapper for fetch requests to include Auth Header
async function fetchAuth(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = headers;
    
    const res = await fetch(url, options);
    if (res.status === 401) {
        // Unauthorized, logout
        document.getElementById('btn-logout').click();
    }
    return res;
}

// ==== STATE ====
let products = [];
let currentBill = [];
let currentTab = 'dashboard-view';
let chartInstance = null;
let currentProductImageBase64 = null;

// ==== DOM ELEMENTS ====
const clockEl = document.getElementById('clock');
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const modalOverlay = document.getElementById('modal-overlay');
const productModal = document.getElementById('product-modal');
const invoiceModal = document.getElementById('invoice-modal');
const adminUserModal = document.getElementById('admin-user-modal');
const categoryModal = document.getElementById('category-modal');

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateClock();
    setInterval(updateClock, 1000);
    
    setupNavigation();
    setupModals();
});

function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
}

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const target = link.getAttribute('data-target');
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            pageTitle.textContent = link.querySelector('.link-name').textContent;
            currentTab = target;
            
            // Load specific view data
            if(target === 'dashboard-view') loadDashboard();
            if(target === 'inventory-view') loadInventory();
            if(target === 'pos-view') loadPOS();
            if(target === 'invoices-view') loadInvoices();
            if(target === 'reports-view') loadReports();
            if(target === 'profile-view') loadProfile();
            if(target === 'admin-view') loadAdminUsers();
        });
    });
    
    // ==== MARKETPLACE ====
    const btnMarketplace = document.getElementById('btn-create-marketplace');
    if (btnMarketplace) {
        btnMarketplace.addEventListener('click', async () => {
            try {
                const res = await fetchAuth(`${API_BASE}/marketplace/enable`, { method: 'POST' });
                if (res.ok) {
                    const domain = window.location.origin;
                    const url = `${domain}/${encodeURIComponent(currentBusiness)}`;
                    // Open the marketplace URL in a new window immediately
                    window.open(url, '_blank');
                } else {
                    alert('Failed to enable marketplace. Make sure you have restarted your server.');
                }
            } catch (err) {
                console.error(err);
                alert('Error enabling marketplace. Did you restart the server?');
            }
        });
    }
}

function setupModals() {
    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-invoice-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-admin-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-category-modal').addEventListener('click', hideModal);
    
    // Add product
    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        currentProductImageBase64 = null;
        document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        document.getElementById('product-modal-title').textContent = 'Add Product';
        loadCategoriesForSelect();
        showModal(productModal);
    });

    // Manage Categories
    document.getElementById('btn-manage-categories').addEventListener('click', () => {
        loadCategoryManagement();
        showModal(categoryModal);
    });

    // Category form submission
    document.getElementById('category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('category-name').value;
        try {
            const res = await fetchAuth(`${API_BASE}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                document.getElementById('category-form').reset();
                loadCategoryManagement();
            }
        } catch (err) { console.error(err); }
    });

    // Handle Image Selection
    document.getElementById('product-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                currentProductImageBase64 = dataUrl;
                document.getElementById('product-image-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Handle Product Form
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const qty = document.getElementById('product-qty').value;
        const price = document.getElementById('product-price').value;
        
        const payload = { 
            name, 
            category,
            quantity: parseInt(qty), 
            price: parseFloat(price),
            image: currentProductImageBase64
        };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
        
        try {
            const res = await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error saving product');
            }
            hideModal();
            loadInventory();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });

    // Print Receipt logic
    document.getElementById('btn-print-receipt').addEventListener('click', () => {
        window.print();
    });
    
    // Admin User Details logic
    document.getElementById('btn-admin-add-user')?.addEventListener('click', () => {
        document.getElementById('admin-user-form').reset();
        document.getElementById('admin-user-id').value = '';
        document.getElementById('admin-password').required = true;
        showModal(document.getElementById('admin-user-modal'));
    });

    // Admin User Edit Form
    document.getElementById('admin-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-user-id').value;
        const business_name = document.getElementById('admin-business-name').value;
        const email = document.getElementById('admin-email').value;
        const whatsapp_number = document.getElementById('admin-whatsapp').value;
        const password = document.getElementById('admin-password').value;
        const marketplace_enabled = document.getElementById('admin-marketplace-enabled').checked;
        const status = document.getElementById('admin-status').value;
        
        try {
            const url = id ? `${API_BASE}/admin/users/${id}` : `${API_BASE}/admin/users`;
            const method = id ? 'PUT' : 'POST';
            const body = { business_name, email, whatsapp_number, marketplace_enabled, status };
            if (password) body.password = password;

            const res = await fetchAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error saving user');
            }
            hideModal();
            loadAdminUsers();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
}

function showModal(modal) {
    modalOverlay.classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    modal.classList.add('active');
}

function hideModal() {
    modalOverlay.classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ==== UTILS ====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs. ');
}

function exportToCSV(filename, rows) {
    let processRow = function(row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) { innerValue = row[j].toLocaleString(); }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"';
            if (j > 0) finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '';
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    let blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    if (link.download !== undefined) {
        let url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ==== PROFILE ====
let currentProfileImageBase64 = null;

document.getElementById('profile-image-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400; const MAX_HEIGHT = 400;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            currentProfileImageBase64 = dataUrl;
            document.getElementById('profile-image-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            document.getElementById('btn-remove-profile-pic').style.display = 'block';
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

document.getElementById('btn-remove-profile-pic').addEventListener('click', () => {
    currentProfileImageBase64 = null;
    document.getElementById('profile-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Profile Pic</span>';
    document.getElementById('btn-remove-profile-pic').style.display = 'none';
    document.getElementById('profile-image-upload').value = '';
});

async function loadProfile() {
    try {
        const res = await fetchAuth(`${API_BASE}/profile`);
        const data = await res.json();
        
        document.getElementById('profile-business-name').value = data.business_name || '';
        document.getElementById('profile-email').value = data.email || '';
        document.getElementById('profile-whatsapp').value = data.whatsapp_number || '';
        document.getElementById('profile-bank-details').value = data.bank_details || '';
        document.getElementById('profile-password').value = ''; // Leave password blank
        
        currentProfileImageBase64 = data.profile_picture || null;
        if (data.profile_picture) {
            document.getElementById('profile-image-preview').innerHTML = `<img src="${data.profile_picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            document.getElementById('btn-remove-profile-pic').style.display = 'block';
            // Also sync top avatar
            document.getElementById('user-avatar').src = data.profile_picture;
            localStorage.setItem('pos_profile_pic', data.profile_picture);
        } else {
            document.getElementById('profile-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Profile Pic</span>';
            document.getElementById('btn-remove-profile-pic').style.display = 'none';
            localStorage.removeItem('pos_profile_pic');
            // Revert top avatar to initials
            document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBusiness || 'User')}&background=6366f1&color=fff`;
        }
    } catch(err) { console.error(err); }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
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
        const res = await fetchAuth(`${API_BASE}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            alert('Profile updated successfully!');
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
            alert('Error updating profile: ' + errData.error);
        }
    } catch(err) { console.error(err); }
});

// ==== DASHBOARD ====
async function loadDashboard() {
    if (!authToken) return;
    try {
        const res = await fetchAuth(`${API_BASE}/dashboard`);
        const stats = await res.json();
        
        document.getElementById('dash-bills-today').textContent = stats.totalBillsToday;
        document.getElementById('dash-bills-month').textContent = stats.totalBillsMonth;
        document.getElementById('dash-income-today').textContent = formatCurrency(stats.dailyIncome);
        document.getElementById('dash-income-month').textContent = formatCurrency(stats.monthlyIncome);
        if (document.getElementById('dash-delivery-today')) {
            document.getElementById('dash-delivery-today').textContent = formatCurrency(stats.dailyDelivery);
        }
        document.getElementById('dash-total-products').textContent = stats.totalProducts;
        document.getElementById('dash-low-stock').textContent = stats.lowStockProducts;

        // Load low stock table
        const resAlerts = await fetchAuth(`${API_BASE}/dashboard/low-stock`);
        const alerts = await resAlerts.json();
        const tbody = document.querySelector('#low-stock-table tbody');
        tbody.innerHTML = '';
        
        alerts.forEach(item => {
            const tr = document.createElement('tr');
            let nameHTML = `<td>${item.name}</td>`;
            if (currentRole === 'admin') {
                nameHTML = `<td>${item.name} <div style="font-size:11px;color:var(--primary);margin-top:2px;">[${item.owner_name}]</div></td>`;
            }
            
            tr.innerHTML = `
                ${nameHTML}
                <td class="text-danger">${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// ==== INVENTORY ====
let adminInventoryFilter = null;

async function loadInventory() {
    try {
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        const tbody = document.querySelector('#inventory-table tbody');
        tbody.innerHTML = '';
        
        // Handle admin inventory filtering
        let productsToRender = products;
        const filterBadge = document.getElementById('inventory-filter-badge');
        if (currentRole === 'admin' && adminInventoryFilter) {
            productsToRender = products.filter(p => p.owner_name === adminInventoryFilter);
            document.getElementById('inventory-filter-name').textContent = adminInventoryFilter;
            filterBadge.style.display = 'flex';
        } else {
            filterBadge.style.display = 'none';
        }
        
        productsToRender.forEach(p => {
            const imgHtml = p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : `<div style="width:40px;height:40px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;">No Img</div>`;
            const tr = document.createElement('tr');
            
            let nameDisplay = `<span>${p.name}</span>`;
            if (currentRole === 'admin') {
                nameDisplay = `<div><span>${p.name}</span><div style="font-size:11px;color:var(--primary);margin-top:2px;">[${p.owner_name}]</div></div>`;
            }
            
            tr.innerHTML = `
                <td style="display:flex;align-items:center;gap:12px;">${imgHtml} ${nameDisplay}</td>
                <td><span class="badge" style="background:var(--secondary);color:var(--text);padding:2px 8px;border-radius:4px;font-size:11px;">${p.category || 'General'}</span></td>
                <td class="${p.quantity <= 10 ? 'text-danger' : ''}">${p.quantity}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only edit-btn" data-id="${p.id}"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only del-btn" data-id="${p.id}"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('btn-clear-inventory-filter').addEventListener('click', () => {
    adminInventoryFilter = null;
    loadInventory();
});

// Event Delegation for Edit and Delete buttons
document.querySelector('#inventory-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        editProduct(editBtn.dataset.id);
        return;
    }
    
    const delBtn = e.target.closest('.del-btn');
    if (delBtn) {
        deleteProduct(delBtn.dataset.id);
    }
});

async function editProduct(id) {
    const p = products.find(prod => prod.id == id);
    if(p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('product-name').value = p.name;
        
        await loadCategoriesForSelect();
        document.getElementById('product-category').value = p.category || 'General';
        
        document.getElementById('product-qty').value = p.quantity;
        document.getElementById('product-price').value = p.price;
        
        currentProductImageBase64 = p.image || null;
        if (p.image) {
            document.getElementById('product-image-preview').innerHTML = `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
        } else {
            document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        }
        
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        showModal(productModal);
    }
}

async function deleteProduct(id) {
    if(confirm('Are you sure you want to delete this product?')) {
        try {
            await fetchAuth(`${API_BASE}/products/${id}`, { method: 'DELETE' });
            loadInventory();
        } catch (err) { console.error(err); }
    }
}

document.getElementById('btn-export-inventory').addEventListener('click', () => {
    const csvData = [['Item Name', 'Quantity', 'Price']];
    products.forEach(p => csvData.push([p.name, p.quantity, p.price]));
    exportToCSV('products.csv', csvData);
});

// ==== POS (NEW BILL) ====
async function loadPOS() {
    currentBill = [];
    updateBillUI();
    document.getElementById('pos-search-input').value = '';
    
    try {
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        renderPOSProducts(products);
    } catch (err) {
        console.error(err);
    }
}

function renderPOSProducts(productArray) {
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';
    
    productArray.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pos-product-card';
        const imgStyle = p.image ? `background-image:url('${p.image}');background-size:cover;background-position:center;` : `background:#e2e8f0;`;
        div.innerHTML = `
            <div style="width:100%;height:100px;border-radius:8px;margin-bottom:12px;${imgStyle}"></div>
            <h4>${p.name}</h4>
            <div class="price">${formatCurrency(p.price)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Stock: ${p.quantity}</div>
        `;
        div.addEventListener('click', () => addToBill(p));
        grid.appendChild(div);
    });
}

document.getElementById('pos-search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderPOSProducts(filtered);
});

function addToBill(product) {
    if (product.quantity <= 0) {
        alert('Product out of stock!');
        return;
    }
    
    const existing = currentBill.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity >= product.quantity) {
             alert('Cannot add more than available stock!');
             return;
        }
        existing.quantity++;
    } else {
        currentBill.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            maxQty: product.quantity
        });
    }
    updateBillUI();
}

function updateBillQuantity(id, change) {
    const item = currentBill.find(i => i.id === id);
    if (item) {
        const newQty = item.quantity + change;
        if (newQty > 0 && newQty <= item.maxQty) {
            item.quantity = newQty;
        } else if (newQty === 0) {
            currentBill = currentBill.filter(i => i.id !== id);
        } else {
             alert('Cannot exceed available stock!');
        }
        updateBillUI();
    }
}

function calculateCurrentBillExtras() {
    let subTotal = currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountInput = document.getElementById('pos-discount');
    const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
    const deliveryFeeInput = document.getElementById('pos-delivery-fee');
    const deliveryFee = parseFloat(deliveryFeeInput ? deliveryFeeInput.value : 0) || 0;
    
    const totalAmount = subTotal - discount + deliveryFee;
    
    const advancePaymentInput = document.getElementById('pos-advance-payment');
    const advancePayment = parseFloat(advancePaymentInput ? advancePaymentInput.value : 0) || 0;
    
    const balance = totalAmount - advancePayment;
    
    const subTotalEl = document.getElementById('pos-sub-total');
    if(subTotalEl) subTotalEl.textContent = formatCurrency(subTotal);
    
    const totalEl = document.getElementById('pos-total-amount');
    if(totalEl) totalEl.textContent = formatCurrency(totalAmount);
    
    const balanceEl = document.getElementById('pos-balance');
    if(balanceEl) balanceEl.textContent = formatCurrency(balance);
}

function updateBillUI() {
    const itemsContainer = document.getElementById('pos-bill-items');
    itemsContainer.innerHTML = '';
    
    currentBill.forEach(item => {
        const amount = item.price * item.quantity;
        
        const div = document.createElement('div');
        div.className = 'bill-item';
        div.innerHTML = `
            <div class="bill-item-details">
                <h4>${item.name}</h4>
                <p>${formatCurrency(item.price)} x ${item.quantity}</p>
            </div>
            <div class="bill-item-actions">
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', 1)">+</button>
                </div>
                <div class="item-total">${formatCurrency(amount)}</div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });
    
    calculateCurrentBillExtras();
}

// Add event listeners for the extra fields
document.getElementById('pos-discount').addEventListener('input', calculateCurrentBillExtras);
document.getElementById('pos-delivery-fee').addEventListener('input', calculateCurrentBillExtras);
document.getElementById('pos-advance-payment').addEventListener('input', calculateCurrentBillExtras);

async function handleBillSubmission(action) {
    if (currentBill.length === 0) {
        alert('Bill is empty!');
        return;
    }
    
    let subTotal = currentBill.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
    const deliveryFee = parseFloat(document.getElementById('pos-delivery-fee').value) || 0;
    let totalAmount = subTotal - discount + deliveryFee;
    const advancePayment = parseFloat(document.getElementById('pos-advance-payment').value) || 0;
    let balance = totalAmount - advancePayment;
    const customerName = document.getElementById('pos-customer-name').value;
    const customerNumber = document.getElementById('pos-customer-number').value;
    
    const payload = {
        items: currentBill,
        sub_total: subTotal,
        discount: discount,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        advance_payment: advancePayment,
        balance: balance,
        customer_name: customerName,
        customer_number: customerNumber
    };
    
    try {
        const res = await fetchAuth(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('Failed to create invoice');
        
        const data = await res.json();
        const invoice = data.invoice;
        
        // Execute specific action after saving
        if (action === 'submit') {
            showInvoicePrintout(invoice);
        } else if (action === 'pdf') {
            await downloadPDF(invoice);
        } else if (action === 'image') {
            await downloadImage(invoice);
        } else if (action === 'whatsapp') {
            shareOnWhatsApp(invoice);
        }
        
        // Clear bill and reset UI components
        currentBill = [];
        document.getElementById('pos-discount').value = '0';
        document.getElementById('pos-delivery-fee').value = '0';
        document.getElementById('pos-advance-payment').value = '0';
        document.getElementById('pos-customer-name').value = '';
        document.getElementById('pos-customer-number').value = '';
        updateBillUI();
        
        // Reload products cache to reflect stock updates
        fetchAuth(`${API_BASE}/products`).then(r => r.json()).then(p => products = p);
        
    } catch (err) {
        console.error(err);
        alert('Error saving bill: ' + err.message);
    }
}

function getInvoiceHTML(invoice) {
    let itemsHTML = invoice.items.map(i => `
        <tr>
            <td style="padding:4px;border-bottom:1px solid #eee;">${i.product_name}</td>
            <td style="padding:4px;border-bottom:1px solid #eee;">${i.quantity}</td>
            <td style="padding:4px;border-bottom:1px solid #eee;">${formatCurrency(i.price)}</td>
            <td style="padding:4px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(i.price * i.quantity)}</td>
        </tr>
    `).join('');

    return `
        <div style="padding: 20px; font-family: 'Inter', sans-serif; background: #fff; color: #000; width: 400px; margin: 0 auto; box-sizing: border-box;">
            <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="margin:0; font-size: 24px; font-weight: bold;">INVOICE</h2>
                <p style="margin:5px 0; font-weight: bold; font-size: 18px;">${currentBusiness || 'InvoicePro'}</p>
                ${currentEmail ? `<p style="margin:2px 0; font-size: 12px; color: #555;">${currentEmail}</p>` : ''}
                ${currentWhatsApp ? `<p style="margin:2px 0; font-size: 12px; color: #555;">WA: ${currentWhatsApp}</p>` : ''}
                <p style="margin:2px 0; font-size: 12px; color: #555;">#${invoice.invoice_number} | ${invoice.date} ${invoice.time}</p>
            </div>
            ${invoice.customer_name || invoice.customer_number ? `
            <div style="margin-bottom: 15px; font-size: 14px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
                ${invoice.customer_name ? `<p style="margin: 2px 0;">Customer: ${invoice.customer_name}</p>` : ''}
                ${invoice.customer_number ? `<p style="margin: 2px 0;">Contact: ${invoice.customer_number}</p>` : ''}
            </div>
            ` : ''}
            <table style="width: 100%; text-align: left; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                <thead>
                    <tr>
                        <th style="padding:4px;border-bottom:1px solid #ccc;">Item</th>
                        <th style="padding:4px;border-bottom:1px solid #ccc;">Qty</th>
                        <th style="padding:4px;border-bottom:1px solid #ccc;">Price</th>
                        <th style="padding:4px;border-bottom:1px solid #ccc;text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
            <div style="border-top:1px solid #000; padding-top: 10px; font-size: 14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>Sub Total:</span><span>${formatCurrency(invoice.sub_total)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>Discount:</span><span>${formatCurrency(invoice.discount)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>Delivery Fee:</span><span>${formatCurrency(invoice.delivery_fee)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-weight: bold; font-size: 16px;"><span>Total Amount:</span><span>${formatCurrency(invoice.total_amount)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px;"><span>Advance Payment:</span><span>${formatCurrency(invoice.advance_payment)}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-weight: bold;"><span>Balance:</span><span>${formatCurrency(invoice.balance)}</span></div>
            </div>
            ${currentBankDetails ? `
            <div style="margin-top: 15px; font-size: 11px; text-align: left;">
                <strong>Bank Details:</strong><br>
                ${currentBankDetails.replace(/\n/g, '<br>')}
            </div>
            ` : ''}
            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
                <p>Thank You!</p>
            </div>
        </div>
    `;
}

async function downloadPDF(invoice) {
    const element = document.createElement('div');
    element.innerHTML = getInvoiceHTML(invoice);
    element.style.position = 'absolute';
    element.style.top = '-9999px';
    document.body.appendChild(element);
    await new Promise(r => setTimeout(r, 100));
    try {
        await html2pdf().from(element.firstElementChild).set({
            margin: 1,
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).save();
    } catch(err) { console.error(err); alert('Failed to generate PDF'); }
    finally { document.body.removeChild(element); }
}

async function downloadImage(invoice) {
    const element = document.createElement('div');
    element.innerHTML = getInvoiceHTML(invoice);
    element.style.position = 'absolute';
    element.style.top = '-9999px';
    document.body.appendChild(element);
    await new Promise(r => setTimeout(r, 100));
    try {
        const canvas = await html2canvas(element.firstElementChild);
        const a = document.createElement('a');
        a.href = canvas.toDataURL("image/png");
        a.download = `Invoice_${invoice.invoice_number}.png`;
        a.click();
    } catch(err) { console.error(err); }
    finally { document.body.removeChild(element); }
}

function shareOnWhatsApp(invoice) {
    const lineShort = "--------------------------------------------------------";
    const lineLong = "-------------------------------------------------------------------------------------------";
    
    let text = `*INVOICE* \n`;
    text += `*${(currentBusiness || 'Business Name')}*\n`;
    text += ` ${invoice.date} - ${invoice.time}\n`;
    text += `${lineShort}\n`;
    text += `👤 Customer: ${invoice.customer_name || ''}\n`;
    text += `${lineShort}\n`;
    
    text += `🛒*ORDER DETAILS :*\n`;
    invoice.items.forEach(i => {
        text += `▫️ ${i.product_name}\n      ${i.quantity} x ${formatCurrency(i.price)} = *${formatCurrency(i.subtotal)}*\n`;
    });
    
    text += `${lineShort}\n`;
    text += `💰 Subtotal: ${formatCurrency(invoice.sub_total)}\n`;
    text += `🏷️ Discount: ${formatCurrency(invoice.discount)}\n`;
    text += `🚚 Delivery: ${formatCurrency(invoice.delivery_fee)}\n`;
    text += `🧮 *Total:* ${formatCurrency(invoice.total_amount)}\n`;
    text += `💵 Advance: ${formatCurrency(invoice.advance_payment)}\n`;
    text += `⚖️ *Balance Due:* *${formatCurrency(invoice.balance)}*\n`;
    text += `${lineLong}\n`;
    text += `📝 *Note :* ⏳ Estimated delivery time: 2–3 working days.\n`;
    text += `${lineLong}\n\n`;
    text += ` ✨ _Thank you for your business!_ ✨`;
    
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

document.getElementById('btn-submit-bill').addEventListener('click', () => handleBillSubmission('submit'));
document.getElementById('btn-generate-pdf').addEventListener('click', () => handleBillSubmission('pdf'));
document.getElementById('btn-generate-image').addEventListener('click', () => handleBillSubmission('image'));
document.getElementById('btn-send-wa').addEventListener('click', () => handleBillSubmission('whatsapp'));

document.getElementById('btn-reset-bill').addEventListener('click', () => {
    currentBill = [];
    document.getElementById('pos-discount').value = '0';
    document.getElementById('pos-delivery-fee').value = '0';
    document.getElementById('pos-advance-payment').value = '0';
    document.getElementById('pos-customer-name').value = '';
    document.getElementById('pos-customer-number').value = '';
    updateBillUI();
});

function showInvoicePrintout(invoice) {
    document.getElementById('receipt-no').textContent = invoice.invoice_number;
    document.getElementById('receipt-date').textContent = invoice.date;
    document.getElementById('receipt-time').textContent = invoice.time;
    
    const biz = invoice.business_details || {};
    document.getElementById('receipt-business-name').textContent = biz.name || currentBusiness || 'InvoicePro';
    document.getElementById('receipt-business-email').textContent = biz.email || '';
    document.getElementById('receipt-business-whatsapp').textContent = biz.whatsapp ? 'WA: ' + biz.whatsapp : '';
    
    if (biz.bank_details) {
        document.getElementById('receipt-bank-details-wrapper').style.display = 'block';
        document.getElementById('receipt-bank-details').innerHTML = biz.bank_details.replace(/\n/g, '<br>');
    } else {
        document.getElementById('receipt-bank-details-wrapper').style.display = 'none';
        document.getElementById('receipt-bank-details').innerHTML = '';
    }
    
    if (invoice.customer_name) {
        document.getElementById('receipt-customer-name-wrapper').style.display = 'block';
        document.getElementById('receipt-customer-name').textContent = invoice.customer_name;
    } else {
        document.getElementById('receipt-customer-name-wrapper').style.display = 'none';
    }
    
    if (invoice.customer_number) {
        document.getElementById('receipt-customer-number-wrapper').style.display = 'block';
        document.getElementById('receipt-customer-number').textContent = invoice.customer_number;
    } else {
        document.getElementById('receipt-customer-number-wrapper').style.display = 'none';
    }
    
    const tbody = document.querySelector('#receipt-items tbody');
    tbody.innerHTML = '';
    
    invoice.items.forEach(item => {
        const amt = item.price * item.quantity;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name || item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.price}</td>
            <td>${amt}</td>
        `;
        tbody.appendChild(tr);
    });
    
    const subTotalEl = document.getElementById('receipt-sub-total');
    if (subTotalEl) subTotalEl.textContent = (invoice.sub_total || 0).toFixed(2);
    
    const discountEl = document.getElementById('receipt-discount');
    if (discountEl) discountEl.textContent = (invoice.discount || 0).toFixed(2);
    
    const deliveryEl = document.getElementById('receipt-delivery-fee');
    if (deliveryEl) deliveryEl.textContent = (invoice.delivery_fee || 0).toFixed(2);
    
    const advanceEl = document.getElementById('receipt-advance-payment');
    if (advanceEl) advanceEl.textContent = (invoice.advance_payment || 0).toFixed(2);
    
    const balanceEl = document.getElementById('receipt-balance');
    if (balanceEl) balanceEl.textContent = (invoice.balance || 0).toFixed(2);
    
    const totalEl = document.getElementById('receipt-total-amount');
    if (totalEl) totalEl.textContent = (invoice.total_amount || 0).toFixed(2);
    
    // Automatically open modal and print dialog as per rules
    showModal(invoiceModal);
    setTimeout(() => {
        window.print();
    }, 500);
}

// ==== INVOICES ====
let invoicesList = [];

async function loadInvoices() {
    const dateFilter = document.getElementById('filter-date').value;
    const monthFilter = document.getElementById('filter-month').value;
    
    let url = `${API_BASE}/invoices`;
    if (dateFilter) url += `?date=${dateFilter}`;
    else if (monthFilter) url += `?month=${monthFilter}`;
    
    try {
        const res = await fetchAuth(url);
        invoicesList = await res.json();
        const tbody = document.querySelector('#invoices-table tbody');
        tbody.innerHTML = '';
        
        invoicesList.forEach(inv => {
            const tr = document.createElement('tr');
            let businessNameDisplay = '';
            if (currentRole === 'admin') {
                businessNameDisplay = `<div style="font-size:11px;color:var(--primary);margin-top:2px;">[${inv.owner_name}]</div>`;
            }
            
            tr.innerHTML = `
                <td>${inv.invoice_number}${businessNameDisplay}</td>
                <td>${inv.date}</td>
                <td>${inv.time}</td>
                <td style="font-weight:bold">${formatCurrency(inv.total_amount)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-invoice-btn" data-id="${inv.id}" title="View"><i class='bx bx-show'></i></button>
                    <button class="btn btn-primary btn-icon-only print-invoice-btn" data-id="${inv.id}" title="Print"><i class='bx bx-printer'></i></button>
                    <button class="btn btn-danger btn-icon-only delete-invoice-btn" style="margin-left: 4px;" data-id="${inv.id}" title="Remove"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.view-invoice-btn, .print-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                try {
                    const res = await fetchAuth(`${API_BASE}/invoices/${id}`);
                    const inv = await res.json();
                    showInvoicePrintout(inv);
                } catch(err) { console.error(err); }
            });
        });
        
        document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Are you sure you want to delete this invoice? (This will restock the inventory automatically)')) {
                    const id = e.currentTarget.dataset.id;
                    try {
                        await fetchAuth(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
                        loadInvoices();
                    } catch(err) { console.error(err); }
                }
            });
        });
        
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('filter-date').addEventListener('change', () => {
    document.getElementById('filter-month').value = '';
    loadInvoices();
});
document.getElementById('filter-month').addEventListener('change', () => {
    document.getElementById('filter-date').value = '';
    loadInvoices();
});
document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-month').value = '';
    loadInvoices();
});

document.getElementById('btn-export-invoices').addEventListener('click', () => {
    const csvData = [['Invoice Number', 'Date', 'Time', 'Total Amount']];
    invoicesList.forEach(i => csvData.push([i.invoice_number, i.date, i.time, i.total_amount]));
    exportToCSV('invoices.csv', csvData);
});

// ==== REPORTS ====
let currentReportMode = 'sales';

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(td => td.classList.remove('active'));
        e.target.classList.add('active');
        currentReportMode = e.target.getAttribute('data-report');
        loadReports();
    });
});

async function loadReports() {
    const thead = document.querySelector('#reports-table thead');
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';
    
    try {
        if (currentReportMode === 'sales') {
            thead.innerHTML = `<tr><th>Date</th><th>Total Sales</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/sales`);
            const data = await res.json();
            data.forEach(row => {
               const tr = document.createElement('tr');
               tr.innerHTML = `<td>${row.date}</td><td>${formatCurrency(row.total_sales)}</td>`;
               tbody.appendChild(tr);
            });
        } else {
            thead.innerHTML = `<tr><th>Product Name</th><th>Quantity Sold</th><th>Revenue</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/product-sales`);
            const data = await res.json();
            data.forEach(row => {
               const tr = document.createElement('tr');
               tr.innerHTML = `<td>${row.product_name}</td><td>${row.quantity_sold}</td><td>${formatCurrency(row.revenue)}</td>`;
               tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// ==== ADMIN VIEW ====
let adminUsersList = [];

async function loadAdminUsers() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/users`);
        adminUsersList = await res.json();
        
        const tbody = document.querySelector('#admin-users-table tbody');
        tbody.innerHTML = '';
        
        adminUsersList.forEach(user => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            if (user.status === 'approved') statusBadge = '<span style="background:var(--success);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">Approved</span>';
            else if (user.status === 'pending') statusBadge = '<span style="background:var(--warning);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">Pending</span>';
            else statusBadge = '<span style="background:var(--danger);color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">Rejected</span>';

            tr.innerHTML = `
                <td>${user.business_name}</td>
                <td>${user.email}</td>
                <td>${user.marketplace_enabled ? '<span class="text-success" style="color:var(--success);font-weight:600;">Enabled</span>' : '<span class="text-muted">Disabled</span>'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-user-inventory-btn" data-id="${user.id}" title="View Inventory"><i class='bx bx-box'></i></button>
                    <button class="btn btn-outline btn-icon-only admin-edit-btn" data-id="${user.id}" title="Edit User"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only admin-del-btn" data-id="${user.id}" title="Delete User"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Event Delegation for Admin Users Edit/Delete
document.querySelector('#admin-users-table tbody').addEventListener('click', async (e) => {
    const viewInvBtn = e.target.closest('.view-user-inventory-btn');
    if (viewInvBtn) {
        const id = viewInvBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
            // Set filter and switch tabs
            adminInventoryFilter = user.business_name;
            
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelector('[data-target="inventory-view"]').classList.add('active');
            
            views.forEach(v => v.classList.remove('active'));
            document.getElementById('inventory-view').classList.add('active');
            
            pageTitle.textContent = "Inventory";
            currentTab = 'inventory-view';
            loadInventory();
        }
        return;
    }

    const editBtn = e.target.closest('.admin-edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
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
        return;
    }
    
    const delBtn = e.target.closest('.admin-del-btn');
    if (delBtn) {
        if(confirm('Are you sure you want to permanently delete this user and ALL their data (products, invoices)?')) {
            try {
                await fetchAuth(`${API_BASE}/admin/users/${delBtn.dataset.id}`, { method: 'DELETE' });
                loadAdminUsers();
            } catch (err) { console.error(err); }
        }
    }
});

async function loadCategoriesForSelect() {
    try {
        const res = await fetchAuth(`${API_BASE}/categories`);
        const categories = await res.json();
        const select = document.getElementById('product-category');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="General">General</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
        if (currentValue) select.value = currentValue;
    } catch (err) { console.error(err); }
}

async function loadCategoryManagement() {
    try {
        const res = await fetchAuth(`${API_BASE}/categories`);
        const categories = await res.json();
        const listContainer = document.getElementById('category-list');
        listContainer.innerHTML = '';
        
        if (categories.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:14px; margin-top:10px;">No categories added yet.</p>';
        }

        categories.forEach(c => {
            const div = document.createElement('div');
            div.style = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);';
            div.innerHTML = `
                <span>${c.name}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')"><i class="bx bx-trash"></i></button>
            `;
            listContainer.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

async function deleteCategory(id) {
    if (confirm('Are you sure you want to delete this category? Products in this category will remain but will show as "General".')) {
        try {
            await fetchAuth(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
            loadCategoryManagement();
        } catch (err) { console.error(err); }
    }
}
