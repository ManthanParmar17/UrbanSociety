// ================= BASE URL =================
const BASE_URL = window.location.origin;

// ================= DATA =================
let complaintsData = [];

// ================= LOAD =================
async function loadComplaints() {
    try {
        const res = await fetch(`${BASE_URL}/get_complaints`);
        const data = await res.json();

        if (!Array.isArray(data)) throw new Error(data.error || "Failed to load complaints");

        complaintsData = data;
        renderComplaints();
        renderStats();

    } catch (e) {
        console.error(e);
        renderComplaints();
        renderStats();
    }
}

// ================= STATS =================
function renderStats() {
    const pending = complaintsData.filter(c => c.status === "pending").length;
    const inProgress = complaintsData.filter(c => c.status === "in-progress").length;
    const resolved = complaintsData.filter(c => c.status === "resolved").length;

    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("progressCount").textContent = inProgress;
    document.getElementById("resolvedCount").textContent = resolved;
}

// ================= RENDER =================
function renderComplaints() {
    const list = document.getElementById("complaintsList");

    if (!complaintsData.length) {
        list.innerHTML = `<p>No complaints</p>`;
        return;
    }

    list.innerHTML = complaintsData.map(c => `
        <div class="complaint-card">
            <h3>${c.title}</h3>
            <p>${c.description}</p>
            <small>${c.member_name}</small>

            <div>
                <button onclick="setStatus(${c.id}, 'in-progress')">Start</button>
                <button onclick="setStatus(${c.id}, 'resolved')">Resolve</button>
                <button onclick="deleteComplaint(${c.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ================= UPDATE STATUS =================
async function setStatus(id, status) {
    try {
        await fetch(`${BASE_URL}/update_complaint_status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                complaint_id: id,
                status: status
            })
        });

        loadComplaints();
    } catch (e) {
        console.error(e);
    }
}

// ================= DELETE =================
async function deleteComplaint(id) {
    if (!confirm("Delete complaint?")) return;

    try {
        await fetch(`${BASE_URL}/delete_complaint/${id}`, {
            method: "DELETE"
        });

        loadComplaints();
    } catch (e) {
        console.error(e);
    }
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('userRole') !== 'admin') {
        window.location.href = '/';
        return;
    }

    loadComplaints();
});