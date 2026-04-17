// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'member') {
        window.location.href = '/';
        return;
    }

    // Ensure memberId is present
    const memberId = parseInt(sessionStorage.getItem('memberId'), 10);
    if (!memberId) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    // Set user name
    const userName = sessionStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    // Load member complaints
    loadMemberComplaints(memberId);
    loadAllComplaints();

    // Auto-refresh to reflect admin updates
    const REFRESH_MS = 10000;
    setInterval(() => {
        loadMemberComplaints(memberId);
        loadAllComplaints();
    }, REFRESH_MS);

    // Manual refresh button (if present)
    const refreshBtn = document.getElementById('refreshComplaints');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadMemberComplaints(memberId));
    }

    // Setup form submission
    setupComplaintForm(memberId);
});

// ==================== LOAD MEMBER COMPLAINTS ====================
function loadMemberComplaints(memberId) {
    const url = `/get_member_complaints?member_id=${encodeURIComponent(memberId)}`;
    fetch(url)
        .then(res => res.json())
        .then(complaints => {
            displayMemberComplaints(complaints);
        })
        .catch(err => {
            console.error("Error loading complaints:", err);
            showToast('Error loading complaints', 'error');
            document.getElementById('complaintsList').innerHTML = `
                <div class="no-complaints">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to load complaints</h3>
                    <p>Please try again later.</p>
                </div>
            `;
        });
}

// ==================== LOAD ALL COMPLAINTS (READ-ONLY) ====================
function loadAllComplaints() {
    fetch("/get_complaints")
        .then(res => res.json())
        .then(complaints => displayAllComplaints(complaints))
        .catch(err => {
            console.error("Error loading all complaints:", err);
            const container = document.getElementById('allComplaintsList');
            if (container) {
                container.innerHTML = `<div class="no-complaints"><i class="fas fa-exclamation-triangle"></i><h3>Unable to load community complaints</h3></div>`;
            }
        });
}

// ==================== DISPLAY MEMBER COMPLAINTS ====================
function displayMemberComplaints(complaints) {
    const container = document.getElementById('complaintsList');

    if (complaints.length === 0) {
        container.innerHTML = `
            <div class="no-complaints">
                <i class="fas fa-plus-circle"></i>
                <h3>No complaints yet</h3>
                <p>You haven't submitted any complaints. Click "Add New Complaint" to get started.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = complaints.map(complaint => `
        <div class="complaint-card" onclick="viewComplaint(${complaint.id})">
            <div class="complaint-header">
                <div class="complaint-title">
                    <h3>${complaint.title}</h3>
                    <span class="complaint-id">#${complaint.id}</span>
                </div>
                <div class="complaint-meta">
                    <span class="priority-badge ${complaint.priority}">${complaint.priority.toUpperCase()}</span>
                    <span class="status-badge ${complaint.status.replace('-', '')}">${complaint.status.replace('-', ' ').toUpperCase()}</span>
                </div>
            </div>
            <div class="complaint-body">
                <p class="complaint-description">${complaint.description}</p>
                <div class="complaint-details">
                    <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDate(complaint.created_at)}</span>
                </div>
            </div>
            <div class="complaint-footer">
                ${complaint.assigned_to ? `<span class="assigned-to"><i class="fas fa-user-check"></i> Assigned to: ${complaint.assigned_to}</span>` : '<span class="unassigned"><i class="fas fa-clock"></i> Waiting for assignment</span>'}
                ${complaint.expected_date ? `<span class="expected-date"><i class="fas fa-calendar-check"></i> Expected: ${formatDate(complaint.expected_date)}</span>` : ''}
            </div>
            <div class="complaint-actions">
                <button class="btn-action danger" onclick="handleDeleteComplaint(event, ${complaint.id})"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

// ==================== SETUP COMPLAINT FORM ====================
function setupComplaintForm(memberId) {
    document.getElementById('complaintForm').addEventListener('submit', function(e) {
        e.preventDefault();

        const title = document.getElementById('complaintTitle').value.trim();
        const category = document.getElementById('complaintCategory').value;
        const priority = document.getElementById('complaintPriority').value;
        const description = document.getElementById('complaintDescription').value.trim();

        if (!title || !category || !description) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        const complaintData = {
            member_id: memberId,
            title: title,
            category: category,
            priority: priority,
            description: description
        };

        console.log("Submitting complaint", complaintData);

        fetch("/add_complaint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(complaintData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            showToast('Complaint submitted successfully!', 'success');
            document.getElementById('complaintForm').reset();
            closeModal('addComplaintModal');
            loadMemberComplaints(memberId); // Reload complaints
        })
        .catch(err => {
            console.error(err);
            showToast('Error submitting complaint: ' + err.message, 'error');
        })
        .finally(() => {
            // Reset button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
        });
}

// ==================== DISPLAY ALL COMPLAINTS ====================
function displayAllComplaints(complaints) {
    const container = document.getElementById('allComplaintsList');
    if (!container) return;

    if (!Array.isArray(complaints) || complaints.length === 0) {
        container.innerHTML = `
            <div class="no-complaints">
                <i class="fas fa-inbox"></i>
                <h3>No community complaints yet</h3>
                <p>When other residents raise complaints, they will appear here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = complaints.slice(0, 20).map(complaint => `
        <div class="complaint-card readonly">
            <div class="complaint-header">
                <div class="complaint-title">
                    <h3>${complaint.title}</h3>
                    <span class="complaint-id">#${complaint.id}</span>
                </div>
                <div class="complaint-meta">
                    <span class="priority-badge ${complaint.priority}">${(complaint.priority || 'medium').toUpperCase()}</span>
                    <span class="status-badge ${complaint.status?.replace('-', '')}">${(complaint.status || 'pending').replace('-', ' ').toUpperCase()}</span>
                </div>
            </div>
            <div class="complaint-body">
                <p class="complaint-description">${complaint.description || ''}</p>
                <div class="complaint-details">
                    <span><i class="fas fa-user"></i> ${complaint.member_name || 'Member ' + complaint.member_id}</span>
                    <span><i class="fas fa-home"></i> ${complaint.flat_id || ''}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDate(complaint.created_at)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== DELETE COMPLAINT ====================
function handleDeleteComplaint(event, complaintId) {
    event.stopPropagation();
    deleteComplaint(complaintId);
}

function deleteComplaint(complaintId) {
    const memberId = parseInt(sessionStorage.getItem('memberId'), 10);
    if (!memberId) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    if (!confirm('Delete this complaint? This cannot be undone.')) return;

    fetch(`/delete_complaint/${complaintId}?member_id=${encodeURIComponent(memberId)}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        showToast('Complaint deleted', 'warning');
        loadMemberComplaints(memberId);
        closeModal('viewComplaintModal');
    })
    .catch(err => {
        console.error('Error deleting complaint:', err);
        showToast('Error deleting complaint: ' + err.message, 'error');
    });
}

// ==================== VIEW COMPLAINT ====================
function viewComplaint(complaintId) {
    const memberId = sessionStorage.getItem('memberId');
    const url = `/get_member_complaints?member_id=${encodeURIComponent(memberId)}`;
    fetch(url)
        .then(res => res.json())
        .then(complaints => {
            const complaint = complaints.find(c => c.id === complaintId);
            if (!complaint) {
                showToast('Complaint not found', 'error');
                return;
            }

            const modal = document.getElementById('viewComplaintModal');
            const details = document.getElementById('complaintDetails');

            details.innerHTML = `
                <div class="complaint-detail-grid">
                    <div class="detail-section">
                        <h4><i class="fas fa-info-circle"></i> Complaint Information</h4>
                        <div class="detail-row">
                            <span class="label">Complaint ID:</span>
                            <span class="value">#${complaint.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Title:</span>
                            <span class="value">${complaint.title}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Category:</span>
                            <span class="value">${complaint.category}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Priority:</span>
                            <span class="value"><span class="priority-badge ${complaint.priority}">${complaint.priority.toUpperCase()}</span></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Status:</span>
                            <span class="value"><span class="status-badge ${complaint.status.replace('-', '')}">${complaint.status.replace('-', ' ').toUpperCase()}</span></span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Submitted:</span>
                            <span class="value">${formatDate(complaint.created_at)}</span>
                        </div>
                    </div>

                    <div class="detail-section full-width">
                        <h4><i class="fas fa-comment"></i> Description</h4>
                        <p class="complaint-description-full">${complaint.description}</p>
                    </div>

                    ${complaint.assigned_to ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-user-check"></i> Assignment Details</h4>
                        <div class="detail-row">
                            <span class="label">Assigned To:</span>
                            <span class="value">${complaint.assigned_to}</span>
                        </div>
                        ${complaint.expected_date ? `
                        <div class="detail-row">
                            <span class="label">Expected Resolution:</span>
                            <span class="value">${formatDate(complaint.expected_date)}</span>
                        </div>
                        ` : ''}
                        ${complaint.resolved_date ? `
                        <div class="detail-row">
                            <span class="label">Resolved Date:</span>
                            <span class="value">${formatDate(complaint.resolved_date)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : `
                    <div class="detail-section">
                        <h4><i class="fas fa-clock"></i> Status</h4>
                        <p>Your complaint is being reviewed by our maintenance team. We'll update you once it's assigned.</p>
                    </div>
                    `}
                </div>
            `;

            modal.style.display = 'block';
        })
        .catch(err => {
            console.error('Error loading complaint details:', err);
            showToast('Error loading complaint details', 'error');
        });
}

// ==================== MODAL FUNCTIONS ====================
function showAddComplaintModal() {
    document.getElementById('addComplaintModal').style.display = 'block';
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
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

// ==================== UTILITY FUNCTIONS ====================
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function goBack() {
    window.history.back();
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}
// ======================== COMMENT ========================
// member_complaints.js â€” logic for member complaint creation, listing, and status display
