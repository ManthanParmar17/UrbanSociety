// ======================== COMMENT ========================\n// complaints.js — logic for admin complaints page (included via its HTML)\n// Simple admin complaints: fetch from backend, render, update status

let complaintsData = [];

async function loadComplaints() {
    try {
        const res = await fetch("http://127.0.0.1:5000/get_complaints");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Failed to load complaints");
        complaintsData = data;
        try { localStorage.setItem('complaints_cache', JSON.stringify(complaintsData)); } catch (_) { }
        renderComplaints();
        renderStats();
    } catch (e) {
        console.error(e);
        const cached = localStorage.getItem('complaints_cache');
        complaintsData = cached ? JSON.parse(cached) : [];
        renderComplaints();
        renderStats();
    }
}

function renderStats() {
    const pending = complaintsData.filter(c => c.status === "pending").length;
    const inProgress = complaintsData.filter(c => c.status === "in-progress").length;
    const resolved = complaintsData.filter(c => c.status === "resolved").length;
    const high = complaintsData.filter(c => c.priority === "high" && c.status !== "resolved").length;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("progressCount").textContent = inProgress;
    document.getElementById("resolvedCount").textContent = resolved;
    document.getElementById("highPriorityCount").textContent = high;
}

let currentComplaintFilterStatus = 'all';
let currentComplaintFilterPriority = 'all';
let currentComplaintSearch = '';

function renderComplaints(filterStatus = currentComplaintFilterStatus, filterPriority = currentComplaintFilterPriority, searchTerm = currentComplaintSearch) {
    currentComplaintFilterStatus = filterStatus;
    currentComplaintFilterPriority = filterPriority;
    currentComplaintSearch = searchTerm;

    const list = document.getElementById("complaintsList");
    let items = complaintsData;

    if (filterStatus !== "all") items = items.filter(c => c.status === filterStatus);
    if (filterPriority !== "all") items = items.filter(c => c.priority === filterPriority);

    if (searchTerm && searchTerm.trim()) {
        const search = searchTerm.trim().toLowerCase();
        items = items.filter(c => {
            return (c.title || '').toLowerCase().includes(search) ||
                (c.description || '').toLowerCase().includes(search) ||
                (c.category || '').toLowerCase().includes(search) ||
                (c.member_name || '').toLowerCase().includes(search);
        });
    }

    if (!items.length) {
        list.innerHTML = `<div class="no-complaints"><i class="fas fa-clipboard-list"></i><p>No complaints found</p></div>`;
        return;
    }
    list.innerHTML = items.map(c => `
        <div class="complaint-card">
            <div class="complaint-header">
                <div>
                    <h3>${c.title}</h3>
                    <small>#${c.id} · ${c.category || 'General'}</small>
                </div>
                <div>
                    <span class="priority-badge ${c.priority || 'medium'}">${(c.priority || 'medium').toUpperCase()}</span>
                    <span class="status-badge ${c.status.replace('-', '')}">${c.status.replace('-', ' ').toUpperCase()}</span>
                </div>
            </div>
            <p class="complaint-desc">${c.description}</p>
            <div class="complaint-meta">
                <span><i class="fas fa-user"></i> ${c.member_name || 'Member ' + c.member_id}</span>
                <span><i class="fas fa-home"></i> ${c.flat_id || ''}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(c.created_at)}</span>
            </div>
            <div class="complaint-actions">
                <button class="btn-action" onclick="setStatus(${c.id}, 'in-progress')"><i class="fas fa-play"></i> Start</button>
                <button class="btn-action" onclick="setStatus(${c.id}, 'resolved')"><i class="fas fa-check"></i> Resolve</button>
                <button class="btn-action" onclick="setStatus(${c.id}, 'rejected')"><i class="fas fa-times"></i> Reject</button>
                <button class="btn-action danger" onclick="deleteComplaint(${c.id})"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function filterComplaints(status, button) {
    const allButtons = document.querySelectorAll('.filter-section .filter-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));
    if (button) button.classList.add('active');
    renderComplaints(status, currentComplaintFilterPriority, currentComplaintSearch);
}

function filterByPriority(priority) {
    const select = document.querySelector('.filter-section select');
    if (select) {
        currentComplaintFilterPriority = priority;
    }
    renderComplaints(currentComplaintFilterStatus, priority, currentComplaintSearch);
}

function searchComplaints() {
    const searchInput = document.getElementById('searchComplaint');
    const searchTerm = searchInput ? searchInput.value : '';
    renderComplaints(currentComplaintFilterStatus, currentComplaintFilterPriority, searchTerm);
}

async function setStatus(id, status) {
    try {
        const res = await fetch("http://127.0.0.1:5000/update_complaint_status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ complaint_id: id, status })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        await loadComplaints();
        showToast(`Complaint #${id} marked ${status}`);
    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

async function deleteComplaint(id) {
    if (!confirm(`Delete complaint #${id}? This cannot be undone.`)) return;
    try {
        const res = await fetch(`http://127.0.0.1:5000/delete_complaint/${id}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        await loadComplaints();
        showToast(`Complaint #${id} deleted`, 'warning');
    } catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('userRole') !== 'admin') {
        window.location.href = '/';
        return;
    }
    loadComplaints();
    setInterval(loadComplaints, 10000);
});
