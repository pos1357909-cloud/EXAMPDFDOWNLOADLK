// ===================== CONFIGURATION =====================
const MATERIALS_API_BASE = '/api/public/materials';
const ADMIN_ADS_API = '/api/admin/ads';
const ADMIN_SETTINGS_API = '/api/admin/site-settings';

// Monetag settings loaded from DB at startup
var monetagDirectLink = '';
var topBannerCode = '';
var bottomBannerCode = '';

// Download state
var currentDownloadId = '';
var currentDownloadItem = null;
var countdownTimer;
var secondsLeft = 5;

// Filter state
var allMaterials = [];
var selectedGrade = 'all';
var selectedCategory = 'all';
var currentBusinessName = '';

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
    // Determine business name if present in URL path
    const pathParts = window.location.pathname.split('/');
    let businessNameRaw = pathParts[pathParts.length - 1];
    let businessName = decodeURIComponent(businessNameRaw);
    if (businessName && businessName !== '/' && businessName !== 'marketplace.html' && businessName !== 'index.html' && businessName !== 'favicon.ico') {
        currentBusinessName = businessName;
    }

    // Apply saved dark theme
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        var themeIcon = document.getElementById('themeIcon');
        if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
    }

    // Load all data in parallel
    await Promise.all([
        loadAdSettings(),
        loadSiteSettings(),
        loadPortalData()
    ]);
});

// ===================== LOAD AD SETTINGS FROM DB =====================
async function loadAdSettings() {
    try {
        const res = await fetch(ADMIN_ADS_API);
        if (!res.ok) return;
        const data = await res.json();

        // Apply Monetag direct link
        if (data.monetagDirectLink && data.monetagDirectLink.trim() !== '') {
            monetagDirectLink = data.monetagDirectLink.trim();
        }

        // Inject top banner HTML/JS
        if (data.topBannerCode && data.topBannerCode.trim() !== '') {
            const topBannerEl = document.getElementById('topBannerSlot');
            if (topBannerEl) {
                topBannerEl.innerHTML = data.topBannerCode;
                // Execute any scripts in the injected banner code
                topBannerEl.querySelectorAll('script').forEach(oldScript => {
                    const newScript = document.createElement('script');
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                        newScript.async = oldScript.async;
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            }
        }

        // Inject bottom banner HTML/JS
        if (data.bottomBannerCode && data.bottomBannerCode.trim() !== '') {
            const bottomBannerEl = document.getElementById('bottomBannerSlot');
            if (bottomBannerEl) {
                bottomBannerEl.innerHTML = data.bottomBannerCode;
                bottomBannerEl.querySelectorAll('script').forEach(oldScript => {
                    const newScript = document.createElement('script');
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                        newScript.async = oldScript.async;
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            }
        }
    } catch (err) {
        console.warn('Ad settings unavailable:', err.message);
    }
}

// ===================== LOAD SITE SETTINGS FROM DB =====================
async function loadSiteSettings() {
    try {
        // Site settings require auth header, but we don't have a token here.
        // Instead we use the public /api/admin/ads endpoint for the WhatsApp number
        // which is stored in SiteSettings. We expose it via a new public endpoint.
        // For now, try to fetch and apply if available.
        const res = await fetch('/api/public/site-settings');
        if (!res.ok) return;
        const data = await res.json();

        // Update portal name if configured
        if (data.siteName && data.siteName.trim() !== '') {
            const logoTitle = document.getElementById('portal-logo-title');
            if (logoTitle) logoTitle.textContent = data.siteName;
            document.title = data.siteName + ' - Study Notes Portal';
            // Update OG meta
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) ogTitle.setAttribute('content', data.siteName);
        }

        // Update WhatsApp link
        if (data.contactWhatsApp && data.contactWhatsApp.trim() !== '') {
            const waLink = document.getElementById('whatsappLink');
            if (waLink) {
                const num = data.contactWhatsApp.replace(/[^0-9]/g, '');
                waLink.href = `https://wa.me/${num}`;
            }
        }
    } catch (err) {
        console.warn('Site settings unavailable:', err.message);
    }
}

// ===================== LOAD MATERIALS =====================
async function loadPortalData() {
    try {
        let materialsUrl = MATERIALS_API_BASE;
        if (currentBusinessName) {
            materialsUrl += `?business_name=${encodeURIComponent(currentBusinessName)}`;
        }
        const res = await fetch(materialsUrl);
        if (res.ok) {
            allMaterials = await res.json();
        }
        renderNotes();
    } catch (err) {
        console.error('Failed to load portal materials:', err);
        renderNotes();
    }
}

// ===================== RENDER MATERIALS =====================
function renderNotes() {
    const grid = document.getElementById('notesGrid');
    const noNotesMsg = document.getElementById('noNotesMsg');
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    if (!grid) return;
    grid.innerHTML = '';

    const filtered = allMaterials.filter(m => {
        const matchesGrade = selectedGrade === 'all' || m.grade == selectedGrade;

        let matchesCat = true;
        if (selectedCategory !== 'all') {
            if (['Short Notes', 'Paper (PDF)', 'Extracurricular Notes'].includes(selectedCategory)) {
                matchesCat = m.material_type === selectedCategory;
            } else {
                matchesCat = m.subject.toLowerCase().includes(selectedCategory.toLowerCase());
            }
        }

        const matchesSearch = !searchVal ||
            m.title.toLowerCase().includes(searchVal) ||
            m.subject.toLowerCase().includes(searchVal) ||
            (m.description && m.description.toLowerCase().includes(searchVal)) ||
            `grade ${m.grade}`.includes(searchVal);

        return matchesGrade && matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
        if (noNotesMsg) noNotesMsg.style.display = 'block';
        return;
    }

    if (noNotesMsg) noNotesMsg.style.display = 'none';

    filtered.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-category', m.subject.toLowerCase());

        // Type icon
        let typeIcon = 'fa-file-pdf';
        if (m.material_type === 'Short Notes') typeIcon = 'fa-file-pen';
        if (m.material_type === 'Extracurricular Notes') typeIcon = 'fa-book-open-reader';

        // Download button: show for any material with a file (base64 or URL)
        const hasDownload = m.has_file;
        const downloadBtnHtml = hasDownload ? `
            <button class="btn-download" onclick="triggerDownload('${m.id}')">
                <i class="fa-solid ${typeIcon}"></i> Download (${m.download_count || 0})
            </button>
        ` : '';

        card.innerHTML = `
            <div>
                <span class="badge">Grade ${m.grade} • ${m.material_type}</span>
                <h3>${escapeHtml(m.title)}</h3>
                <p style="font-weight:600; color:var(--primary-color); margin-bottom:6px;">
                    <i class="fa-solid fa-book"></i> ${escapeHtml(m.subject)}
                </p>
                <p>${escapeHtml(m.description || 'සටහනක් සූදානම් කර ඇත.')}</p>
            </div>
            <div>
                <button class="btn-download btn-read-note" onclick="openPreview('${m.id}')" style="margin-bottom:10px;">
                    <i class="fa-solid fa-eye"></i> Read Note / Preview
                </button>
                ${downloadBtnHtml}
            </div>
        `;

        grid.appendChild(card);
    });
}

// ===================== FILTER FUNCTIONS =====================
function filterNotes() { renderNotes(); }

function filterCategory(category, btn) {
    document.querySelectorAll('.category-filters .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    selectedCategory = category;
    renderNotes();
}

function filterGrade(grade, btn) {
    document.querySelectorAll('.grade-filters .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    selectedGrade = grade;
    renderNotes();
}

// ===================== DARK MODE =====================
function toggleDarkMode() {
    var currentTheme = document.body.getAttribute('data-theme');
    var themeIcon = document.getElementById('themeIcon');
    if (currentTheme === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (themeIcon) themeIcon.className = 'fa-solid fa-moon';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
    }
}

// ===================== DOWNLOAD TRIGGER =====================
function triggerDownload(id) {
    currentDownloadId = id;
    currentDownloadItem = allMaterials.find(m => m.id === id) || null;
    secondsLeft = 5;

    // Open Monetag ad in new tab (only if configured)
    if (monetagDirectLink) {
        window.open(monetagDirectLink, '_blank');
    }

    // Show countdown modal
    document.getElementById('timerDisplay').innerText = secondsLeft;
    document.getElementById('downloadModal').style.display = 'flex';

    clearInterval(countdownTimer);
    countdownTimer = setInterval(async () => {
        secondsLeft--;
        document.getElementById('timerDisplay').innerText = secondsLeft;

        if (secondsLeft <= 0) {
            clearInterval(countdownTimer);
            document.getElementById('downloadModal').style.display = 'none';
            await executeDownload(currentDownloadId);
        }
    }, 1000);
}

// ===================== EXECUTE DOWNLOAD =====================
async function executeDownload(id) {
    try {
        const res = await fetch(`/api/public/materials/download/${id}`, { method: 'POST' });
        if (!res.ok) throw new Error('Download failed');
        const data = await res.json();

        // Update local download count
        const item = allMaterials.find(m => m.id === id);
        if (item) {
            item.download_count = data.download_count;
            renderNotes();
        }

        if (data.is_drive_url && data.drive_url) {
            // Google Drive / external URL — open in new tab
            window.open(data.drive_url, '_blank');
        } else if (data.file_data) {
            // Base64 encoded file — create download link
            const link = document.createElement('a');
            link.href = data.file_data;
            link.download = data.file_name || `${(data.title || 'note').replace(/[^a-zA-Z0-9]/g, '_')}_Grade${data.grade}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // No file attached — show preview
            openPreview(id);
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('Download failed. Please try again.');
    }
}

// ===================== PREVIEW MODAL =====================
function openPreview(id) {
    const item = allMaterials.find(m => m.id === id);
    if (!item) return;

    document.getElementById('prevBadge').textContent = `Grade ${item.grade} • ${item.material_type}`;
    document.getElementById('prevTitle').textContent = item.title;
    document.getElementById('prevSubject').innerHTML = `<i class="fa-solid fa-book"></i> ${escapeHtml(item.subject)} <span style="color:var(--text-muted); font-weight:400;">(${escapeHtml(item.publisher_name || 'EduPortal Academy')})</span>`;
    document.getElementById('prevContent').textContent = item.description || 'සටහනේ සම්පූර්ණ විස්තරයක් ඇතුළත් කර නොමැත.';

    const dlBtn = document.getElementById('prevDlBtn');
    if (item.has_file) {
        dlBtn.style.display = 'flex';
        dlBtn.onclick = () => {
            closeModal();
            triggerDownload(item.id);
        };
        // Label drive vs embedded
        if (item.is_drive_url) {
            dlBtn.innerHTML = '<i class="fa-brands fa-google-drive"></i> Open / Download via Drive';
        } else {
            dlBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> Download Attachment / PDF';
        }
    } else {
        dlBtn.style.display = 'none';
    }

    document.getElementById('previewModal').style.display = 'flex';
}

// ===================== CLOSE MODALS =====================
function closeModal() {
    clearInterval(countdownTimer);
    document.getElementById('downloadModal').style.display = 'none';
    document.getElementById('requestModal').style.display = 'none';
    document.getElementById('previewModal').style.display = 'none';
}

// ===================== REQUEST NOTE MODAL =====================
function openRequestModal() {
    document.getElementById('requestModal').style.display = 'flex';
}

function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reqName').value;
    const subject = document.getElementById('reqSubject').value;
    alert(`ස්තූතියි ${name}! ඔබගේ "${subject}" සටහන් ඉල්ලීම සාර්ථකව යොමු කෙරුණි. ඉක්මණින්ම සටහන එකතු කරනු ලැබේ!`);
    closeModal();
}

// ===================== HELPER =====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
