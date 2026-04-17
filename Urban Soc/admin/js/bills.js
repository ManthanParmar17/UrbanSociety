// ================= BASE URL =================
const BASE_URL = window.location.origin;

// ==================== BILLS DATA ====================
let billsData = [];
let membersList = [];
let editingBillId = null;
let editingBillStatus = 'pending';

// ================= LOAD BILLS =================
function loadBillsData() {
    fetch(`${BASE_URL}/get_bills`)
        .then(res => res.json())
        .then(bills => {
            billsData = bills.map(bill => ({
                id: bill.id,
                memberId: bill.member_id,
                member: bill.member_name || `Member ${bill.member_id}`,
                flat: bill.flat_id || `Flat ${bill.member_id}`,
                type: (bill.description || '').split(' - ')[0] || 'Bill',
                period: (bill.description || '').split(' - ')[1] || bill.due_date || 'N/A',
                amount: parseFloat(bill.amount || 0),
                dueDate: bill.due_date,
                status: bill.status,
                items: [{
                    description: bill.description || 'Bill',
                    quantity: 1,
                    price: bill.amount,
                    amount: bill.amount
                }],
                notes: bill.description || '',
                createdAt: bill.created_at
            }));

            updateBillsDisplay();
            loadBills();
        })
        .catch(err => console.error("Error loading bills:", err));
}

// ================= LOAD MEMBERS =================
function loadMembers() {
    fetch(`${BASE_URL}/get_members`)
        .then(res => res.json())
        .then(members => {
            membersList = members;
            const select = document.getElementById('memberSelect');
            if (!select) return;

            select.innerHTML = `<option value="">Choose Member</option>` +
                members.map(m => `<option value="${m.id}">${m.name} (${m.flat_id})</option>`).join('');
        })
        .catch(err => console.error("Error loading members:", err));
}

// ================= ADD BILL =================
function saveBillToDatabase(billData) {
    return fetch(`${BASE_URL}/add_bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            member_id: billData.memberId,
            amount: billData.amount,
            description: billData.description,
            due_date: billData.dueDate,
            status: 'pending'
        })
    }).then(res => res.json());
}

// ================= UPDATE BILL =================
function updateBillInDatabase(billData) {
    return fetch(`${BASE_URL}/update_bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(billData)
    }).then(res => res.json());
}

// ================= UPDATE STATUS =================
function updateBillStatusInDatabase(id, status) {
    return fetch(`${BASE_URL}/update_bill_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill_id: id, status })
    }).then(res => res.json());
}

// ================= DELETE BILL =================
function deleteBill(billId) {
    if (!confirm('Delete this bill?')) return;

    fetch(`${BASE_URL}/delete_bill/${billId}`, {
        method: "DELETE"
    })
        .then(res => res.json())
        .then(() => {
            loadBillsData();
            alert("Deleted successfully");
        })
        .catch(err => console.error(err));
}

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    loadBillsData();
    loadMembers();
});

// ================= DISPLAY =================
function loadBills() {
    const table = document.getElementById('billsTableBody');
    if (!table) return;

    table.innerHTML = billsData.map(bill => `
        <tr>
            <td>#${bill.id}</td>
            <td>${bill.member}</td>
            <td>${bill.flat}</td>
            <td>${bill.type}</td>
            <td>${bill.period}</td>
            <td>₹ ${bill.amount}</td>
            <td>${bill.dueDate}</td>
            <td>${bill.status}</td>
            <td>
                <button onclick="deleteBill(${bill.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// ================= STATS =================
function updateBillsDisplay() {
    const total = billsData.length;
    document.getElementById('totalBills').textContent = total;
}