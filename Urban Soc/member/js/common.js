// Shared helpers for member pages
function ensureMemberAuth() {
    const role = sessionStorage.getItem('userRole');
    if (role !== 'member') {
        sessionStorage.clear();
        window.location.href = '/';
        return false;
    }
    return true;
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}

// Dropdown toggle (click instead of hover for reliability)
document.addEventListener('click', (e) => {
    const dropdown = e.target.closest('.dropdown');
    document.querySelectorAll('.dropdown-content.show').forEach(el => {
        if (!dropdown || !dropdown.contains(el)) el.classList.remove('show');
    });
    if (dropdown && e.target.closest('.user-profile')) {
        const menu = dropdown.querySelector('.dropdown-content');
        if (menu) menu.classList.toggle('show');
    }
});

function goBack() {
    if (history.length > 1) {
        history.back();
    } else {
        window.location.href = '/';
    }
}

window.ensureMemberAuth = ensureMemberAuth;
window.logout = logout;
window.goBack = goBack;

// Remove Help option from dropdowns and apply avatar when available
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.dropdown-content a').forEach(a => {
        if (a.textContent.trim().toLowerCase() === 'help') a.remove();
    });
    applyMemberAvatar();
});

function applyMemberAvatar() {
    const profile = document.querySelector('.user-profile');
    if (!profile) return;
    const memberId = sessionStorage.getItem('memberId');
    const dataRaw = memberId ? localStorage.getItem(`member_profile_${memberId}`) : null;
    const data = dataRaw ? JSON.parse(dataRaw) : {};
    let img = profile.querySelector('.user-avatar');
    if (!img) {
        img = document.createElement('img');
        img.className = 'user-avatar';
        profile.insertBefore(img, profile.firstChild);
    }
    const icon = profile.querySelector('i.fas.fa-user-circle');
    if (data.photo) {
        img.src = data.photo;
        img.style.display = 'block';
        if (icon) icon.style.display = 'none';
    } else {
        img.style.display = 'none';
        if (icon) icon.style.display = 'inline-block';
    }
    if (data.name) {
        const nameEl = profile.querySelector('.user-name');
        if (nameEl) nameEl.textContent = data.name;
    }
}

window.applyMemberAvatar = applyMemberAvatar;
// ======================== COMMENT ========================
// common.js — shared helpers for member pages (auth/logout/nav)
