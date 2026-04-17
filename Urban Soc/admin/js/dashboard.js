// ================= BASE URL =================
const BASE_URL = window.location.origin;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', function () {
    const userRole = sessionStorage.getItem('userRole');

    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName');
    if (userName) {
        const nameEl = document.getElementById('userName');
        if (nameEl) {
            nameEl.textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
        }
    }

    loadDashboardData();
});

// ================= LOAD DATA =================
function loadDashboardData() {

    Promise.all([
        fetch(`${BASE_URL}/get_members`).then(r => r.json()),
        fetch(`${BASE_URL}/get_complaints`).then(r => r.json()),
        fetch(`${BASE_URL}/get_bills`).then(r => r.json()),
        fetch(`${BASE_URL}/get_events`).then(r => r.json()),
    ])
    .then(([members, complaints, bills, events]) => {

        // MEMBERS
        document.getElementById("totalMembers").innerText = members.length;

        // COMPLAINTS
        const openComplaints = complaints.filter(c =>
            c.status === 'pending' || c.status === 'in-progress'
        );

        document.getElementById("openComplaints").innerText = openComplaints.length;

        // BILLS
        const pendingBills = bills.filter(b =>
            b.status === 'pending' || b.status === 'partial'
        );

        const pendingAmount = pendingBills.reduce((sum, bill) =>
            sum + parseFloat(bill.amount || 0), 0
        );

        document.getElementById("pendingBills").innerText = pendingBills.length;

        const pendingLabel = document.querySelector('[data-pending-amount]');
        if (pendingLabel) {
            pendingLabel.textContent = `₹ ${pendingAmount.toFixed(2)} pending`;
        }

        // EVENTS
        const today = new Date().toISOString().split('T')[0];
        const eventsToday = events.filter(e =>
            (e.date || '').split('T')[0] === today
        );

        document.getElementById("todayEvents").innerText = eventsToday.length;

        renderRecentComplaints(complaints);
        renderUpcomingEvents(events);
        renderNewMembers(members);
    })
    .catch(err => {
        console.error("Dashboard load error:", err);
    });
}

// ================= RECENT COMPLAINTS =================
function renderRecentComplaints(complaints) {
    const tbody = document.getElementById('complaintsTable');
    if (!tbody) return;

    const slice = complaints.slice(0, 5);

    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="5">No complaints</td></tr>`;
        return;
    }

    tbody.innerHTML = slice.map(c => `
        <tr>
            <td>#${c.id}</td>
            <td>${c.member_name || 'Member'}</td>
            <td>${c.title || 'Complaint'}</td>
            <td>${c.status}</td>
            <td><a href="complaints.html">View</a></td>
        </tr>
    `).join('');
}

// ================= EVENTS =================
function renderUpcomingEvents(events) {
    const list = document.getElementById('eventList');
    if (!list) return;

    const upcoming = events.slice(0, 3);

    list.innerHTML = upcoming.map(ev => `
        <div>
            <strong>${ev.title}</strong>
            <small>${ev.date}</small>
        </div>
    `).join('');
}

// ================= MEMBERS =================
function renderNewMembers(members) {
    const list = document.getElementById('newMembersList');
    if (!list) return;

    const recent = members.slice(-3);

    list.innerHTML = recent.map(m => `
        <div>
            <strong>${m.name}</strong>
            <small>${m.flat_id}</small>
        </div>
    `).join('');
}

// ================= BACK =================
function goBack() {
    window.history.back();
}