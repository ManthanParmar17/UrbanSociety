// ======================== COMMENT ========================\n// script.js — logic for admin script page (included via its HTML)\n// Global admin functions
function checkAdminAuth() {
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// API calls (mock)
async function apiCall(endpoint, method = 'GET', data = null) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock responses
    const mockData = {
        'members': { total: 156, active: 148 },
        'complaints': { open: 8, total: 45 },
        'bills': { pending: 23, total: 89000 }
    };
    
    return mockData[endpoint] || { success: true, data: [] };
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    
    // Set admin name from session
    const adminEmail = sessionStorage.getItem('userEmail');
    const adminNameEl = document.getElementById('adminName');
    if (adminEmail && adminNameEl) {
        adminNameEl.textContent =
            adminEmail.split('@')[0].charAt(0).toUpperCase() +
            adminEmail.split('@')[0].slice(1);
    }

    removeHelpLinks();
    applyAdminAvatar();
});

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        window.location.href = '/';
    }
}

// Graceful back navigation for nav bar
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// Export functions for use in other pages
window.checkAdminAuth = checkAdminAuth;
window.formatDate = formatDate;
window.showNotification = showNotification;
window.apiCall = apiCall;
window.logout = logout;
window.goBack = goBack;
window.applyAdminAvatar = applyAdminAvatar;

// Dropdown toggle on click (more reliable than hover)
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

// Remove Help option from all dropdowns
function removeHelpLinks() {
    document.querySelectorAll('.dropdown-content a').forEach(a => {
        if (a.textContent.trim().toLowerCase() === 'help') {
            a.remove();
        }
    });
}

// Apply admin avatar stored in localStorage (key: admin_profile.photo)
function applyAdminAvatar() {
    const profile = document.querySelector('.user-profile');
    if (!profile) return;
    const dataRaw = localStorage.getItem('admin_profile');
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
    if (data.role) {
        const roleEl = profile.querySelector('.user-role');
        if (roleEl) roleEl.textContent = data.role;
    }
}
