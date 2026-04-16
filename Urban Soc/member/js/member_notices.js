document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (role !== 'member') {
        window.location.href = '/';
        return;
    }
    document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Member';
    loadNotices();
    setInterval(loadNotices, 10000);
});

function normalizeRecipient(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''); // strip spaces, dashes, punctuation
}

function loadNotices() {
    const container = document.getElementById('noticesContainer');
    const memberIdNorm = normalizeRecipient(sessionStorage.getItem('memberId'));
    const flatIdNorm = normalizeRecipient(sessionStorage.getItem('flatId'));
    fetch("http://127.0.0.1:5000/get_notices")
        .then(res => res.json())
        .then(notices => renderNotices(notices, memberIdNorm, flatIdNorm))
        .catch(err => {
            console.error(err);
            container.innerHTML = `<div class="empty"><i class="fas fa-exclamation-circle"></i> Unable to load notices.</div>`;
        });
}

function renderNotices(list, memberIdNorm, flatIdNorm) {
    const container = document.getElementById('noticesContainer');
    const hidden = getHiddenNotices();
    if (!list || list.length === 0) {
        container.innerHTML = `<div class="empty"><i class="fas fa-bullhorn"></i> No notices yet.</div>`;
        return;
    }
    const filtered = list
        .filter(n => !hidden.includes(Number(n.id)))
        // recipient targeting removed -> all notices visible to all members
        ;

    if (!filtered.length) {
        container.innerHTML = `<div class="empty"><i class="fas fa-bullhorn"></i> No notices for you.</div>`;
        return;
    }

    container.innerHTML = filtered.map(n => `
        <div class="card">
            <div class="notice-title">${n.title}</div>
            <div class="notice-date"><i class="fas fa-calendar"></i> ${formatDate(n.created_at)}</div>
            <div class="notice-body">${n.description}</div>
            <div class="notice-actions">
                <button class="btn-secondary" onclick="hideNotice(${Number(n.id)})">Remove</button>
            </div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return 'Today';
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-GB', opts);
}

function getHiddenNotices() {
    try {
        return JSON.parse(localStorage.getItem('hidden_notices') || '[]').map(Number);
    } catch (_) {
        return [];
    }
}

function hideNotice(id) {
    const list = getHiddenNotices();
    if (!list.includes(Number(id))) {
        list.push(Number(id));
        localStorage.setItem('hidden_notices', JSON.stringify(list));
    }
    loadNotices();
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}
// ======================== COMMENT ========================
// member_notices.js — member notices feed with local hide capability
