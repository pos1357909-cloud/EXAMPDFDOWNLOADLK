const MATERIALS_API_BASE = '/api/public/materials';

var currentDriveUrl = "";
var currentDownloadId = "";
var countdownTimer;
var secondsLeft = 5;

// Monetag Direct Link URL
var monetagDirectLink = "https://omg10.com/4/11453715";

var allMaterials = [];
var selectedGrade = 'all';
var selectedCategory = 'all';
var currentBusinessName = '';

document.addEventListener('DOMContentLoaded', async () => {
    // Determine business name if present in URL
    const pathParts = window.location.pathname.split('/');
    let businessNameRaw = pathParts[pathParts.length - 1];
    let businessName = decodeURIComponent(businessNameRaw);

    if (businessName && businessName !== '/' && businessName !== 'marketplace.html' && businessName !== 'index.html' && businessName !== 'favicon.ico') {
        currentBusinessName = businessName;
    }

    // Apply saved dark theme
    var savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.setAttribute("data-theme", "dark");
        var themeIcon = document.getElementById("themeIcon");
        if (themeIcon) themeIcon.className = "fa-solid fa-sun";
    }

    await loadPortalData();
});

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
    } else {
        if (noNotesMsg) noNotesMsg.style.display = 'none';

        filtered.forEach(m => {
            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-category', m.subject.toLowerCase());

            let typeIcon = 'fa-file-pdf';
            if (m.material_type === 'Short Notes') typeIcon = 'fa-file-pen';
            if (m.material_type === 'Extracurricular Notes') typeIcon = 'fa-book-open-reader';

            card.innerHTML = `
                <div>
                    <span class="badge">Grade ${m.grade} • ${m.material_type}</span>
                    <h3>${m.title}</h3>
                    <p style="font-weight:600; color:var(--primary-color); margin-bottom:6px;">
                        <i class="fa-solid fa-book"></i> ${m.subject}
                    </p>
                    <p>${m.description || 'සටහනක් සූදානම් කර ඇත.'}</p>
                </div>
                <div>
                    <button class="btn-download btn-read-note" onclick="openPreview('${m.id}')" style="margin-bottom:10px;">
                        <i class="fa-solid fa-eye"></i> Read Note / Preview
                    </button>
                    ${m.has_file ? `
                        <button class="btn-download" onclick="triggerDownload('${m.id}')">
                            <i class="fa-solid ${typeIcon}"></i> Download PDF (${m.download_count || 0})
                        </button>
                    ` : ''}
                </div>
            `;

            grid.appendChild(card);
        });
    }
}

// Live Search Filter
function filterNotes() {
    renderNotes();
}

// Category Filter
function filterCategory(category, btn) {
    var buttons = document.querySelectorAll('.category-filters .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    selectedCategory = category;
    renderNotes();
}

// Grade Filter
function filterGrade(grade, btn) {
    var buttons = document.querySelectorAll('.grade-filters .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    selectedGrade = grade;
    renderNotes();
}

// Dark Mode Toggle
function toggleDarkMode() {
    var currentTheme = document.body.getAttribute("data-theme");
    var themeIcon = document.getElementById("themeIcon");
    if (currentTheme === "dark") {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
        if (themeIcon) themeIcon.className = "fa-solid fa-moon";
    } else {
        document.body.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        if (themeIcon) themeIcon.className = "fa-solid fa-sun";
    }
}

// Download Modal & Timer Handler
function triggerDownload(id) {
    currentDownloadId = id;
    secondsLeft = 5;
    
    // 1. Open Monetag Direct Link in a New Tab
    window.open(monetagDirectLink, "_blank");

    // 2. Show Modal with Countdown
    document.getElementById("timerDisplay").innerText = secondsLeft;
    document.getElementById("downloadModal").style.display = "flex";

    // Start Countdown Timer
    clearInterval(countdownTimer);
    countdownTimer = setInterval(async function() {
        secondsLeft--;
        document.getElementById("timerDisplay").innerText = secondsLeft;

        if (secondsLeft <= 0) {
            clearInterval(countdownTimer);
            document.getElementById("downloadModal").style.display = "none";
            
            // Increment download count and download file
            await executeDownload(currentDownloadId);
        }
    }, 1000);
}

async function executeDownload(id) {
    try {
        const res = await fetch(`/api/public/materials/download/${id}`, { method: 'POST' });
        if (!res.ok) throw new Error('Download failed');

        const data = await res.json();
        
        // Update local state and UI download count
        const item = allMaterials.find(m => m.id === id);
        if (item) {
            item.download_count = data.download_count;
            renderNotes();
        }

        if (data.file_data) {
            const link = document.createElement('a');
            link.href = data.file_data;
            link.download = data.file_name || `${data.title.replace(/[^a-zA-Z0-9]/g, '_')}_Grade${data.grade}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert(`"${data.title}" සටහන කියවීම සඳහා Read Note බොත්තම ඔබන්න.`);
        }
    } catch (err) {
        console.error(err);
    }
}

function openPreview(id) {
    const item = allMaterials.find(m => m.id === id);
    if (!item) return;

    document.getElementById('prevBadge').textContent = `Grade ${item.grade} • ${item.material_type}`;
    document.getElementById('prevTitle').textContent = item.title;
    document.getElementById('prevSubject').innerHTML = `<i class="fa-solid fa-book"></i> ${item.subject} (${item.publisher_name || 'InvoicePro Academy'})`;
    document.getElementById('prevContent').textContent = item.description || 'සටහනේ සම්පූර්ණ විස්තරයක් ඇතුළත් කර නොමැත.';

    const dlBtn = document.getElementById('prevDlBtn');
    if (item.has_file) {
        dlBtn.style.display = 'flex';
        dlBtn.onclick = () => {
            closeModal();
            triggerDownload(item.id);
        };
    } else {
        dlBtn.style.display = 'none';
    }

    document.getElementById('previewModal').style.display = 'flex';
}

function closeModal() {
    clearInterval(countdownTimer);
    document.getElementById("downloadModal").style.display = "none";
    document.getElementById("requestModal").style.display = "none";
    document.getElementById("previewModal").style.display = "none";
}

function openRequestModal() {
    document.getElementById("requestModal").style.display = "flex";
}

function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reqName').value;
    const subject = document.getElementById('reqSubject').value;
    const details = document.getElementById('reqDetails').value;

    alert(`ස්තූතියි ${name}! ඔබගේ "${subject}" සටහන් ඉල්ලීම සාර්ථකව යොමු කෙරුණි. ඉක්මණින්ම සටහන එකතු කරනු ලැබේ!`);
    closeModal();
}
