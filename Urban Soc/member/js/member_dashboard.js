const API = "";

window.addEventListener("DOMContentLoaded", initDashboard);

async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error((data && data.error) || `Request failed (${response.status})`);
    }

    return data;
}

function initDashboard() {
    if (!ensureMemberAuth()) return;

    const name = sessionStorage.getItem("userName") || "Member";
    document.getElementById("userName").innerText = name;

    const memberId = sessionStorage.getItem("memberId");
    if (!memberId) {
        sessionStorage.clear();
        window.location.href = "/";
        return;
    }

    loadStats(memberId);
    loadNotices();
    loadEvents();
    loadBills(memberId);
}

async function loadStats(memberId) {
    try {
        const [bills, complaints, events, members] = await Promise.all([
            fetchJson(`${API}/get_member_bills?member_id=${encodeURIComponent(memberId)}`).catch(() => []),
            fetchJson(`${API}/get_member_complaints?member_id=${encodeURIComponent(memberId)}`).catch(() => []),
            fetchJson(`${API}/get_events`).catch(() => []),
            fetchJson(`${API}/get_members`).catch(() => []),
        ]);

        const pendingBills = Array.isArray(bills) ? bills.filter(b => b.status !== "paid").length : 0;
        const openComplaints = Array.isArray(complaints)
            ? complaints.filter(c => !["resolved", "rejected"].includes((c.status || "").toLowerCase())).length
            : 0;
        const upcomingEvents = Array.isArray(events)
            ? events.filter(e => e.date && new Date(e.date) >= new Date(new Date().toDateString())).length
            : 0;
        const totalMembers = Array.isArray(members) ? members.length : 0;

        document.getElementById("pendingBills").textContent = pendingBills;
        document.getElementById("openComplaints").textContent = openComplaints;
        document.getElementById("todayEvents").textContent = upcomingEvents;
        document.getElementById("totalMembers").textContent = totalMembers;
    } catch (e) {
        console.error("Stats load error", e);
    }
}

async function loadNotices() {
    const listEl = document.getElementById("noticesList");
    try {
        const data = await fetchJson(`${API}/get_notices`);
        const notices = Array.isArray(data) ? data.slice(0, 3) : [];
        if (!notices.length) {
            listEl.innerHTML = `<li class="muted">No notices yet</li>`;
            return;
        }
        listEl.innerHTML = notices
            .map(n => `<li><span class="pill grey">Notice</span> <strong>${n.title}</strong> - ${formatDate(n.created_at)}</li>`)
            .join("");
    } catch (e) {
        console.error("Notices error", e);
        listEl.innerHTML = `<li class="muted">Unable to load notices</li>`;
    }
}

async function loadEvents() {
    const listEl = document.getElementById("eventsList");
    try {
        const data = await fetchJson(`${API}/get_events`);
        const events = Array.isArray(data)
            ? data
                .filter(e => e.date && new Date(e.date) >= new Date(new Date().toDateString()))
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 3)
            : [];
        if (!events.length) {
            listEl.innerHTML = `<li class="muted">No upcoming events</li>`;
            return;
        }
        listEl.innerHTML = events
            .map(ev => `<li><span class="pill blue">${ev.type || "Event"}</span> <strong>${ev.title}</strong> - ${formatDate(ev.date)}</li>`)
            .join("");
    } catch (e) {
        console.error("Events error", e);
        listEl.innerHTML = `<li class="muted">Unable to load events</li>`;
    }
}

async function loadBills(memberId) {
    const listEl = document.getElementById("billsList");
    try {
        const bills = await fetchJson(`${API}/get_member_bills?member_id=${encodeURIComponent(memberId)}`);
        const billArr = Array.isArray(bills) ? bills.slice(0, 3) : [];
        if (!billArr.length) {
            listEl.innerHTML = `<li class="muted">No bills issued</li>`;
            return;
        }
        listEl.innerHTML = billArr
            .map(b => `<li><span class="pill ${b.status === "paid" ? "green" : "amber"}">${b.status || "pending"}</span> Rs ${b.amount} - ${b.description || "Bill"}</li>`)
            .join("");
    } catch (e) {
        console.error("Bills error", e);
        listEl.innerHTML = `<li class="muted">Unable to load bills</li>`;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// ======================== COMMENT ========================
// member_dashboard.js - loads member stats, bills, and complaints for the home view
