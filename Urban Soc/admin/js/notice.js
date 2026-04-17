// ======================== COMMENT ========================\n// notice.js â€” logic for admin notice page (included via its HTML)\nlet noticesData = [];
let noticeTypeFilter = 'all';
let noticeDateFilter = 'all';
let editingNoticeId = null;

// ==================== LOAD NOTICES FROM BACKEND ====================
function loadNoticesData() {
    fetch("/get_notices")
        .then(res => res.json())
        .then(data => {
            noticesData = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
            renderNotices();
        })
        .catch(() => renderNotices());
}

// ==================== DISPLAY NOTICES ====================
function renderNotices() {
    const list = document.getElementById('noticesList');
    if (!list) return;

    const filtered = noticesData.filter(n => {
        const type = (n.type || 'general').toLowerCase();
        const status = (n.status || 'published').toLowerCase();

        if (noticeTypeFilter !== 'all' && type !== noticeTypeFilter && status !== noticeTypeFilter) return false;

        if (noticeDateFilter !== 'all') {
            const created = new Date(n.created_at);
            const now = new Date();
            if (noticeDateFilter === 'today') {
                const todayStr = now.toDateString();
                if (created.toDateString() !== todayStr) return false;
            } else if (noticeDateFilter === 'week') {
                const diff = (now - created) / (1000 * 60 * 60 * 24);
                if (diff > 7) return false;
            } else if (noticeDateFilter === 'month') {
                if (created.getMonth() !== now.getMonth() || created.getFullYear() !== now.getFullYear()) return false;
            }
        }
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = '<div class="notice-card"><div class="notice-content">No notices found</div></div>';
        return;
    }

    list.innerHTML = filtered.map(notice => `
        <div class="notice-card ${notice.type || 'general'}">
            <div class="notice-header">
                <div>
                    <span class="notice-badge badge-${notice.type || 'general'}">${(notice.type || 'general').toUpperCase()}</span>
                    ${notice.status === 'draft' ? '<span class="notice-badge badge-draft">DRAFT</span>' : ''}
                </div>
                <span>${new Date(notice.created_at).toUTCString()}</span>
            </div>

            <h3 class="notice-title">${notice.title}</h3>

            <div class="notice-content">${notice.description}</div>

            <div class="notice-footer">
                <button onclick="startEditNotice(${notice.id})">Edit</button>
                <button onclick="deleteNotice(${notice.id})">Delete</button>
            </div>
        </div>
    `).join('');
}


// ==================== ADD NOTICE (IMPORTANT) ====================

document.getElementById("noticeForm").addEventListener("submit", function(e) {
    e.preventDefault();
    submitNotice('published');
});


// ==================== DELETE NOTICE ====================

function deleteNotice(id) {
    return fetch(`/delete_notice/${id}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(data => {
        alert("Deleted âœ…");
        loadNoticesData();
        return data;
    });
}


// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', function() {
    const userRole = sessionStorage.getItem('userRole');

    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent =
            userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    loadNoticesData(); // load from DB
});

// ==================== FILTERS ====================
function filterNotices(type) {
    noticeTypeFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.textContent.toLowerCase().includes(type === 'all' ? 'all' : type));
    if (btn) btn.classList.add('active');
    renderNotices();
}

function filterByDate(range) {
    noticeDateFilter = range;
    renderNotices();
}

function saveAsDraft() {
    submitNotice('draft');
}

function submitNotice(status) {
    const title = document.getElementById("noticeTitle").value;
    const description = document.getElementById("noticeContent").value;
    const type = document.getElementById("noticeType").value || 'general';
    if (!title || !description) {
        alert("Please add title and description.");
        return;
    }

    const payload = { title, description, type, status };

    const addNotice = () => fetch("/add_notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(res => res.json());

    const doSubmit = editingNoticeId
        ? deleteNotice(editingNoticeId).catch(() => ({})).then(addNotice)
        : addNotice();

    doSubmit
        .then(() => {
            alert(editingNoticeId ? "Notice updated" : status === 'draft' ? "Draft saved" : "Notice added");
            document.getElementById("noticeForm").reset();
            editingNoticeId = null;
            loadNoticesData();
        })
        .catch(err => {
            console.error(err);
            alert("Failed to save notice");
        });
}


// ==================== OTHER FUNCTIONS (UNCHANGED) ====================

function toggleNoticeForm() {
    document.getElementById('createNoticeForm').classList.toggle('active');
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}

function startEditNotice(id) {
    const notice = noticesData.find(n => Number(n.id) === Number(id));
    if (!notice) return;
    editingNoticeId = id;
    document.getElementById("noticeTitle").value = notice.title || '';
    document.getElementById("noticeContent").value = notice.description || '';
    document.getElementById("noticeType").value = (notice.type || 'general');
    document.getElementById("noticeValidFrom").value = notice.valid_from || '';
    document.getElementById("noticeValidUntil").value = notice.valid_until || '';
    const form = document.getElementById('createNoticeForm');
    if (form && !form.classList.contains('active')) form.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
