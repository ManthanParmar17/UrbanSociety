// ======================== COMMENT ========================\n// members.js — logic for admin members page (included via its HTML)\n// ==================== AUTHENTICATION & INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return;
    }

    // Set user name
    const userName = sessionStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    // Load members and notifications
    loadMembers();
    loadNotifications();

    // Setup form submission
    setupMemberForm();
});

let membersCache = [];
let editingMemberId = null;

// ==================== MEMBER FORM SETUP ====================
function setupMemberForm() {
    document.getElementById("memberForm").addEventListener("submit", function (e) {
        e.preventDefault();

        const name = document.getElementById("memberName").value.trim();
        const email = document.getElementById("memberEmail").value.trim();
        const flat = document.getElementById("memberFlat").value.trim();

        if (!name || !email || !flat) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        const payload = { name, email, flatId: flat };
        const url = editingMemberId ? "http://127.0.0.1:5000/update_member" : "http://127.0.0.1:5000/add_member";
        if (editingMemberId) payload.id = editingMemberId;

        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    showToast(editingMemberId ? 'Member updated successfully!' : 'Member added successfully!', 'success');
                    document.getElementById("memberForm").reset();
                    editingMemberId = null;
                    submitBtn.textContent = 'Add Member';
                    loadMembers(); // reload table
                } else {
                    throw new Error(data.error || 'Failed to add member');
                }
            })
            .catch(err => {
                console.error(err);
                showToast('Error saving member: ' + err.message, 'error');
            })
            .finally(() => {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
    });
}

// ==================== LOAD MEMBERS ====================
function loadMembers() {
    fetch("http://127.0.0.1:5000/get_members")
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("membersTable");
            membersCache = Array.isArray(data) ? data : [];

            try { localStorage.setItem('members_cache', JSON.stringify(data || [])); } catch (_) {}

            if (data.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px;">
                            <i class="fas fa-users" style="font-size: 48px; color: #ccc;"></i>
                            <p style="margin-top: 10px; color: #666;">No members found</p>
                        </td>
                    </tr>
                `;
                return;
            }

            table.innerHTML = data.map((m, i) => `
                <tr>
                    <td>${m.id}</td>
                    <td>${m.name}</td>
                    <td>${m.email}</td>
                    <td>${m.flat_id}</td>
                    <td>
                        <button class="btn-action" onclick="editMember(${m.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteMember(${m.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        })
        .catch(err => {
            console.error(err);
            showToast('Error loading members', 'error');
            const cached = localStorage.getItem('members_cache');
            const fallback = cached ? JSON.parse(cached) : [];
            const table = document.getElementById("membersTable");
            if (!fallback.length) {
                table.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: #f44336;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i>
                            <p style="margin-top: 10px;">Failed to load members</p>
                        </td>
                    </tr>
                `;
            } else {
                table.innerHTML = fallback.map((m, i) => `
                    <tr>
                        <td>${m.id || i + 1}</td>
                        <td>${m.name || 'Member'}</td>
                        <td>${m.email || ''}</td>
                        <td>${m.flat_id || ''}</td>
                        <td>
                            <button class="btn-action" onclick="editMember(${m.id || i})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action delete" onclick="deleteMember(${m.id || i})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        });
}

// ==================== EDIT MEMBER ====================
function editMember(memberId) {
    const member = membersCache.find(m => m.id === memberId);
    if (!member) {
        showToast('Member not found. Please refresh.', 'error');
        return;
    }

    document.getElementById("memberName").value = member.name || '';
    document.getElementById("memberEmail").value = member.email || '';
    document.getElementById("memberFlat").value = member.flat_id || '';

    editingMemberId = memberId;
    const submitBtn = document.querySelector('#memberForm button[type=\"submit\"]');
    if (submitBtn) submitBtn.textContent = 'Update Member';
    showToast('Editing member - make changes and save.', 'info');
}

// ==================== DELETE MEMBER ====================
function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this member?')) {
        return;
    }

    fetch(`http://127.0.0.1:5000/delete_member/${memberId}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                showToast('Member deleted', 'warning');
                loadMembers();
            } else {
                throw new Error(data.error || 'Failed to delete');
            }
        })
        .catch(err => {
            console.error(err);
            showToast('Error deleting member: ' + err.message, 'error');
        });
}

// ==================== NOTIFICATIONS ====================
function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('show');
}

function closeNotifications() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.remove('show');
}

function loadNotifications() {
    const notifications = [];

    // Fetch real members count from database
    fetch("http://127.0.0.1:5000/get_members")
        .then(res => res.json())
        .then(members => {
            if (members.length > 0) {
                notifications.push({
                    type: 'member',
                    title: `${members.length} Total Members in System`,
                    time: 'Updated today',
                    icon: 'fas fa-users'
                });
            }

            // Fetch real bills data from database
            return fetch("http://127.0.0.1:5000/get_bills");
        })
        .then(res => res.json())
        .then(bills => {
            const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'partial');
            if (pendingBills.length > 0) {
                const totalAmount = pendingBills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0);
                notifications.push({
                    type: 'bill',
                    title: `${pendingBills.length} Pending Bills (₹${totalAmount.toFixed(2)})`,
                    time: 'Action needed',
                    icon: 'fas fa-file-invoice'
                });
            }

            // Display notifications
            displayNotifications(notifications);
        })
        .catch(err => {
            console.error("Error loading data for notifications:", err);
            displayNotifications(notifications);
        });
}

function displayNotifications(notifications) {
    const notificationsList = document.getElementById('notificationsList');
    const notificationCount = document.getElementById('notificationCount');

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No notifications</div>';
        notificationCount.textContent = '0';
        return;
    }

    notificationCount.textContent = notifications.length;

    notificationsList.innerHTML = notifications.map((notif, index) => `
                <div class="notification-item ${index === 0 ? 'unread' : ''}">
                    <i class="notification-icon ${notif.type} ${notif.icon}"></i>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-time">${notif.time}</div>
                    </div>
                </div>
            `).join('');
}

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    switch (type) {
        case 'success': icon = 'fa-check-circle'; break;
        case 'error': icon = 'fa-exclamation-circle'; break;
        case 'warning': icon = 'fa-exclamation-triangle'; break;
        case 'info': icon = 'fa-info-circle'; break;
    }

    toast.innerHTML = `
                <i class="fas ${icon}"></i>
                <span class="toast-message">${message}</span>
                <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
            `;

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// ==================== SEARCH FUNCTIONALITY ====================
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#membersTable tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
});

// ==================== GO BACK FUNCTION ====================
function goBack() {
    window.history.back();
}

// Close notifications when clicking outside
document.addEventListener('click', function (e) {
    const notifBadge = document.querySelector('.notification-badge');
    if (notifBadge && !notifBadge.contains(e.target)) {
        closeNotifications();
    }
});
