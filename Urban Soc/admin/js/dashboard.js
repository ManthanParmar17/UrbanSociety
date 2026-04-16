// dashboard.js — logic for admin dashboard page (included via its HTML)\n// Dashboard data loader with offline/cache fallbacks
document.addEventListener('DOMContentLoaded', function () {
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName');
    if (userName) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    loadDashboardData();
    loadNotifications();
});

function loadDashboardData() {
    const safeParse = (key) => {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); }
        catch (_) { return []; }
    };

    Promise.all([
        fetch("http://127.0.0.1:5000/get_members").then(r => r.json()).catch(() => safeParse('members_cache')),
        fetch("http://127.0.0.1:5000/get_complaints").then(r => r.json()).catch(() => safeParse('complaints_cache')),
        fetch("http://127.0.0.1:5000/get_bills").then(r => r.json()).catch(() => safeParse('bills_cache')),
        fetch("http://127.0.0.1:5000/get_events").then(r => r.json()).catch(() => safeParse('events_cache')),
    ]).then(([members, complaints, bills, events]) => {
        if (!members?.length) members = safeParse('members_cache');
        if (!complaints?.length) complaints = safeParse('complaints_cache');
        if (!bills?.length) bills = safeParse('bills_cache');
        if (!events?.length) events = safeParse('events_cache');

        document.getElementById("totalMembers").innerText = members.length;

        const openComplaints = complaints.filter(c => c.status === 'pending' || c.status === 'in-progress');
        const highPriorityCount = complaints.filter(c => c.priority === 'high').length;
        document.getElementById("openComplaints").innerText = openComplaints.length;
        const priorityElement = document.querySelector('#openComplaints')?.parentElement?.querySelector('small');
        if (priorityElement) priorityElement.textContent = `${highPriorityCount} high priority`;

        const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'partial');
        const pendingAmount = pendingBills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0);
        document.getElementById("pendingBills").innerText = pendingBills.length;
        const pendingLabel = document.querySelector('[data-pending-amount]');
        if (pendingLabel) pendingLabel.textContent = `₹ ${pendingAmount.toFixed(2)} pending`;

        const today = new Date().toISOString().split('T')[0];
        const eventsToday = events.filter(e => (e.date || '').split('T')[0] === today);
        document.getElementById("todayEvents").innerText = eventsToday.length;
        const nextTitle = eventsToday[0]?.title || events[0]?.title || 'Next at --';
        const nextLabel = document.querySelector('[data-today-next]');
        if (nextLabel) nextLabel.textContent = nextTitle;

        renderRecentComplaints(complaints);
        renderUpcomingEvents(events);
        renderNewMembers(members);
    });
}

function renderRecentComplaints(complaints) {
    const tbody = document.getElementById('complaintsTable');
    if (!tbody) return;
    const slice = complaints.slice(0, 5);
    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">No complaints yet</td></tr>`;
        return;
    }
    tbody.innerHTML = slice.map(c => `
        <tr>
            <td>#${c.id}</td>
            <td>${c.member_name || 'Member ' + c.member_id}</td>
            <td>${c.title || c.category || 'Complaint'}</td>
            <td><span class="status-badge ${ (c.status || '').replace('-','') }">${c.status}</span></td>
            <td><a class="action-link" href="complaints.html">View</a></td>
        </tr>
    `).join('');
}

function renderUpcomingEvents(events) {
    const list = document.getElementById('eventList');
    if (!list) return;
    const upcoming = events
        .filter(e => e.date && new Date(e.date) >= new Date(new Date().toDateString()))
        .sort((a,b)=> new Date(a.date) - new Date(b.date))
        .slice(0,3);
    if (!upcoming.length) {
        list.innerHTML = `<div class="muted">No upcoming events</div>`;
        return;
    }
    list.innerHTML = upcoming.map(ev => `
        <div class="event-item">
            <div class="event-time">${formatEventTime(ev.date, ev.start_time)}</div>
            <div class="event-details">
                <strong>${ev.title}</strong>
                <small>${ev.venue || ev.type || 'Venue TBD'}</small>
            </div>
        </div>
    `).join('');
}

function renderNewMembers(members) {
    const list = document.getElementById('newMembersList');
    if (!list) return;
    const recent = members.slice(-3).reverse();
    if (!recent.length) {
        list.innerHTML = `<div class="muted">No members yet</div>`;
        return;
    }
    list.innerHTML = recent.map((m, idx) => `
        <div class="member-item">
            <div class="member-avatar"><i class="fas fa-user-circle"></i></div>
            <div class="member-info">
                <strong>${m.name || 'Member'}</strong>
                <small>${m.flat_id || ''} · ${m.email || ''}</small>
            </div>
        </div>
    `).join('');
}

function formatEventTime(dateStr, timeStr) {
    if (!dateStr) return 'TBD';
    const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
    const opts = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
    return d.toLocaleDateString('en-US', opts);
}

function goBack() { window.history.back(); }
