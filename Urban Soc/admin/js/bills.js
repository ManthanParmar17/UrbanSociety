// ======================== COMMENT ========================\n// bills.js — logic for admin bills page (included via its HTML)\n// ==================== BILLS DATA ====================
let billsData = [];
let membersList = [];
let editingBillId = null;
let editingBillStatus = 'pending';

// ======================Load bills from database API =========================
function loadBillsData() {
    fetch("http://127.0.0.1:5000/get_bills")
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
                items: [{ description: bill.description || 'Bill', quantity: 1, price: bill.amount, amount: bill.amount }],
                notes: bill.description || '',
                createdAt: bill.created_at
            }));
            try { localStorage.setItem('bills_cache', JSON.stringify(billsData)); } catch (_) { }
            updateBillsDisplay();
            loadBills(); // Load bills after data is loaded
        })
        .catch(err => {
            console.error("Error loading bills:", err);
            const cached = localStorage.getItem('bills_cache');
            billsData = cached ? JSON.parse(cached) : [];
            updateBillsDisplay();
            loadBills();
        });
}

// Load members into select dropdown
function loadMembers() {
    fetch("http://127.0.0.1:5000/get_members")
        .then(res => res.json())
        .then(members => {
            membersList = Array.isArray(members) ? members : [];
            const select = document.getElementById('memberSelect');
            if (!select) return;
            select.innerHTML = `<option value=\"\">Choose Member</option>` + membersList.map(m => {
                const label = `${m.name || 'Member'} (${m.flat_id || ''})`;
                return `<option value=\"${m.id}\" data-flat=\"${m.flat_id || ''}\">${label}</option>`;
            }).join('');
        })
        .catch(err => {
            console.error("Error loading members", err);
        });
}

// Save bill to database
function saveBillToDatabase(billData) {
    return fetch("http://127.0.0.1:5000/add_bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            member_id: billData.memberId,
            amount: billData.amount,
            description: billData.description,
            due_date: billData.dueDate,
            status: 'pending'
        })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message) {
                loadBillsData(); // Reload bills after adding
                return result;
            } else {
                throw new Error(result.error || "Failed to save bill");
            }
        });
}

function updateBillInDatabase(billData) {
    return fetch("http://127.0.0.1:5000/update_bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: billData.id,
            member_id: billData.memberId,
            amount: billData.amount,
            description: billData.description,
            due_date: billData.dueDate,
            status: billData.status || 'pending'
        })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message) {
                loadBillsData();
                return result;
            }
            throw new Error(result.error || "Failed to update bill");
        });
}

// Update bill status in database
function updateBillStatusInDatabase(billId, status) {
    return fetch("http://127.0.0.1:5000/update_bill_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            bill_id: billId,
            status: status
        })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message) {
                loadBillsData(); // Reload bills after updating
                return result;
            } else {
                throw new Error(result.error || "Failed to update bill");
            }
        });
}

// Current tab and filters
let currentTab = 'all';
let currentFilters = {
    status: 'all',
    type: 'all',
    month: 'all',
    search: ''
};

// Selected bill for payment
let selectedBillForPayment = null;
let selectedPaymentMethod = null;

// ==================== DASHBOARD STATS ====================
function updateBillsDisplay() {
    const totalBillsEl = document.getElementById('totalBills');
    const paidBillsEl = document.getElementById('paidBills');
    const collectedAmountEl = document.getElementById('collectedAmount');
    const pendingBillsEl = document.getElementById('pendingBills');
    const overdueBillsEl = document.getElementById('overdueBills');
    const overdueAmountEl = document.getElementById('overdueAmount');
    const pendingAmountLabel = document.querySelector('[data-pending-amount]');

    if (!totalBillsEl) return; // page not ready

    const totalBills = billsData.length;
    const paidBills = billsData.filter(b => (b.status || '').toLowerCase() === 'paid');
    const pendingBills = billsData.filter(b => {
        const st = (b.status || '').toLowerCase();
        return st === 'pending' || st === 'partial';
    });
    const overdueBills = billsData.filter(b => (b.status || '').toLowerCase() === 'overdue');

    const sumAmounts = list => list.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    totalBillsEl.textContent = totalBills;
    paidBillsEl.textContent = paidBills.length;
    collectedAmountEl.textContent = sumAmounts(paidBills).toLocaleString('en-IN');
    pendingBillsEl.textContent = pendingBills.length;
    overdueBillsEl.textContent = overdueBills.length;
    overdueAmountEl.textContent = sumAmounts(overdueBills).toLocaleString('en-IN');

    if (pendingAmountLabel) {
        const amt = sumAmounts(pendingBills);
        pendingAmountLabel.textContent = `₹ ${amt.toLocaleString('en-IN')} pending`;
    }
}

// ==================== INITIALIZATION ====================
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

    // Set today's date for due date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dueDate').value = today;

    // Set payment date
    document.getElementById('paymentDate').value = today;

    // Load bills from database first, then display
    loadBillsData();
    loadMembers();

    // Load notifications
    loadNotifications();
});

function toggleGenerateForm() {
    const form = document.getElementById('generateBillForm');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
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

    // Pending complaints
    const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
    const pendingComplaints = complaints.filter(c => c.status === 'pending');
    if (pendingComplaints.length) {
        notifications.push({
            type: 'complaint',
            title: `${pendingComplaints.length} pending complaint${pendingComplaints.length === 1 ? '' : 's'}`,
            time: 'Just now',
            icon: 'fas fa-exclamation-circle'
        });
    }

    // Pending bills
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'partial');
    if (pendingBills.length) {
        notifications.push({
            type: 'bill',
            title: `${pendingBills.length} pending bill${pendingBills.length === 1 ? '' : 's'}`,
            time: 'Needs attention',
            icon: 'fas fa-file-invoice'
        });
    }

    // Upcoming events
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    if (events.length) {
        notifications.push({
            type: 'event',
            title: `${events.length} upcoming event${events.length === 1 ? '' : 's'}`,
            time: 'Upcoming',
            icon: 'fas fa-calendar-alt'
        });
    }

    displayNotifications(notifications);
}

function displayNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    const count = document.getElementById('notificationCount');

    if (!notifications.length) {
        list.innerHTML = '<div style="padding: 18px; text-align: center; color: #777;">No new notifications</div>';
        count.textContent = '0';
        return;
    }

    count.textContent = notifications.length;
    list.innerHTML = notifications.map((notif, index) => `
                <div class="notification-item ${index === 0 ? 'unread' : ''}" onclick="closeNotifications()">
                    <div class="notification-icon ${notif.type}"><i class="${notif.icon}"></i></div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-time">${notif.time}</div>
                    </div>
                </div>
            `).join('');
}

// Close notifications when clicking outside
document.addEventListener('click', function (e) {
    const badge = document.querySelector('.notification-badge');
    if (badge && !badge.contains(e.target)) {
        closeNotifications();
    }
});

// ==================== LOAD BILLS ====================
function loadBills() {
    const tableBody = document.getElementById('billsTableBody');
    let filteredBills = filterBillsData();

    if (filteredBills.length === 0) {
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px;">
                            <i class="fas fa-file-invoice" style="font-size: 48px; color: #ccc;"></i>
                            <p style="margin-top: 10px; color: #666;">No bills found</p>
                        </td>
                    </tr>
                `;
    } else {
        tableBody.innerHTML = filteredBills.map(bill => `
                    <tr>
                        <td>#${bill.id}</td>
                        <td>${bill.member}</td>
                        <td>${bill.flat}</td>
                        <td>${bill.type}</td>
                        <td>${bill.period}</td>
                        <td>₹ ${bill.amount.toLocaleString()}</td>
                        <td>${formatDate(bill.dueDate)}</td>
                        <td><span class="status-badge ${bill.status}">${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn view" onclick="viewBill(${bill.id})" title="View Details"><i class="fas fa-eye"></i></button>
                                ${bill.status !== 'paid' ? `
                                    <button class="action-btn send" onclick="sendReminder(${bill.id})" title="Send Reminder"><i class="fas fa-bell"></i></button>
                                ` : ''}
                                ${bill.status === 'pending' || bill.status === 'partial' ? `
                                    <button class="action-btn print" onclick="openPaymentModal(${bill.id})" title="Record Payment"><i class="fas fa-credit-card"></i></button>
                                ` : ''}
                                <button class="action-btn print" onclick="printBill(${bill.id})" title="Print Bill"><i class="fas fa-print"></i></button>
                                <button class="action-btn edit" onclick="editBill(${bill.id})" title="Edit Bill"><i class="fas fa-edit"></i></button>
                                <button class="action-btn delete" onclick="deleteBill(${bill.id})" title="Delete Bill"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('');
    }

    updateStats();
    updateNotificationCount();
}

// ==================== FILTER BILLS ====================
function filterBillsData() {
    return billsData.filter(bill => {
        // Status filter
        if (currentFilters.status !== 'all' && (bill.status || '').toLowerCase() !== currentFilters.status) {
            return false;
        }

        // Type filter
        if (currentFilters.type !== 'all' && (bill.type || '').toLowerCase() !== currentFilters.type.toLowerCase()) {
            return false;
        }

        // Month filter
        if (currentFilters.month !== 'all' && (bill.period || '').toLowerCase() !== currentFilters.month.toLowerCase()) {
            return false;
        }

        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            const normalizedTerm = searchTerm.replace(/\s+/g, '');
            const flatNorm = (bill.flat || '').toLowerCase().replace(/\s+/g, '');
            return String(bill.id).toLowerCase().includes(searchTerm) ||
                (bill.member || '').toLowerCase().includes(searchTerm) ||
                flatNorm.includes(normalizedTerm);
        }

        return true;
    });
}

// ==================== FILTER BILLS (UI) ====================
function filterBills() {
    currentFilters.status = document.getElementById('statusFilter').value;
    currentFilters.type = document.getElementById('typeFilter').value;
    currentFilters.month = document.getElementById('monthFilter').value;
    loadBills();
}

// ==================== SEARCH BILLS ====================
function searchBills() {
    currentFilters.search = document.getElementById('searchInput').value;
    loadBills();
}

// ==================== SWITCH TAB ====================
function switchTab(tab, element) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');

    // Update filter
    currentTab = tab;
    if (tab === 'all') {
        currentFilters.status = 'all';
    } else {
        currentFilters.status = tab;
        document.getElementById('statusFilter').value = tab;
    }

    loadBills();
}

// ==================== UPDATE STATS ====================
function updateStats() {
    const totalBills = billsData.length;
    const paidBills = billsData.filter(b => b.status === 'paid').length;
    const pendingBills = billsData.filter(b => b.status === 'pending').length;
    const overdueBills = billsData.filter(b => b.status === 'overdue').length;

    const collectedAmount = billsData
        .filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + b.amount, 0);

    const pendingAmount = billsData
        .filter(b => b.status === 'pending' || b.status === 'partial')
        .reduce((sum, b) => sum + (b.amount - (b.payment?.amount || 0)), 0);

    const overdueAmount = billsData
        .filter(b => b.status === 'overdue')
        .reduce((sum, b) => sum + b.amount, 0);

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('totalBills', totalBills);
    setText('paidBills', paidBills);
    setText('pendingBills', pendingBills);
    setText('overdueBills', overdueBills);

    setText('collectedAmount', collectedAmount.toLocaleString());
    setText('overdueAmount', overdueAmount.toLocaleString());

    const pendingLabel = document.querySelector('[data-pending-amount]');
    if (pendingLabel) pendingLabel.textContent = `₹ ${pendingAmount.toLocaleString()} pending`;
}

// ==================== UPDATE NOTIFICATION COUNT ====================
function updateNotificationCount() {
    const overdueCount = billsData.filter(b => b.status === 'overdue').length;
    const paidCount = billsData.filter(b => b.status === 'paid').length;
    const badge = document.getElementById('notificationCount');
    if (badge) badge.textContent = overdueCount + paidCount;
}

// ==================== FORMAT DATE ====================
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// ==================== GENERATE BILL ====================
function generateBill(event) {
    event.preventDefault();

    // Get form values
    const memberElement = document.getElementById('memberSelect');
    const member = memberElement?.value;
    const memberManual = document.getElementById('memberNameManual')?.value.trim();
    const type = document.getElementById('billType').value;
    const typeManual = document.getElementById('billTypeManual')?.value.trim();
    const period = document.getElementById('billPeriod').value;
    const dueDate = document.getElementById('dueDate').value;
    const notes = document.getElementById('billNotes').value;

    const chosenType = typeManual || type;

    // Validate member
    let memberId = null;
    let memberName = '';

    if (memberManual) {
        const input = memberManual.toLowerCase();
        const foundMember = membersList.find(m => {
            const name = (m.name || '').toLowerCase();
            const flat = (m.flat_id || '').toLowerCase();
            const label = `${m.name || ''} (${m.flat_id || ''})`.toLowerCase();
            return name === input || label === input || flat === input || name.includes(input) || label.includes(input);
        });

        if (!foundMember) {
            // Fallback: allow if currently selected dropdown member is set and valid
            if (member) {
                memberId = parseInt(member, 10);
                const selected = membersList.find(m => m.id === memberId);
                if (selected) {
                    memberName = selected.name;
                }
            }

            if (!memberId) {
                showToast('Member not found. Choose a valid member from dropdown or type exact member name (or name+flat).', 'error');
                return;
            }
        } else {
            memberId = foundMember.id;
            memberName = foundMember.name;
        }
    } else if (member) {
        memberId = parseInt(member, 10);
        const foundMember = membersList.find(m => m.id === memberId);
        if (!foundMember) {
            // Use dropdown text as fallback when list isn't loaded fully
            const selectedText = memberElement?.selectedOptions?.[0]?.text || '';
            memberName = selectedText.split(' (')[0] || '';
            if (!memberName) {
                showToast('Selected member not found. Please refresh the page.', 'error');
                return;
            }
        } else {
            memberName = foundMember.name;
        }
    } else {
        showToast('Please select or enter a member.', 'error');
        return;
    }

    // Validate other fields
    if (!chosenType || !period || !dueDate) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    // Get items
    const items = [];
    const itemRows = document.querySelectorAll('.item-row');
    let totalAmount = 0;

    itemRows.forEach(row => {
        const desc = row.querySelector('.item-desc').value;
        const qty = parseFloat(row.querySelector('.item-qty').value);
        const price = parseFloat(row.querySelector('.item-price').value);
        const amount = qty * price;

        if (desc && qty > 0 && price > 0) {
            items.push({
                description: desc,
                quantity: qty,
                price: price,
                amount: amount
            });
            totalAmount += amount;
        }
    });

    if (items.length === 0) {
        showToast('Please add at least one bill item', 'error');
        return;
    }

    // Create bill data for database
    const billData = {
        id: editingBillId,
        memberId: memberId,
        memberName: memberName,
        amount: totalAmount,
        description: `${chosenType} - ${period}`,
        dueDate: dueDate,
        status: editingBillStatus || 'pending'
    };

    const saver = editingBillId ? updateBillInDatabase : saveBillToDatabase;

    const wasEditing = !!editingBillId;
    saver(billData)
        .then(() => {
            document.getElementById('billForm').reset();
            document.getElementById('totalAmount').textContent = '0';
            editingBillId = null;
            editingBillStatus = 'pending';
            toggleGenerateForm();
            loadBillsData();
            showToast(wasEditing ? 'Bill updated successfully!' : 'Bill generated successfully!');
        })
        .catch(error => {
            showToast('Error saving bill: ' + error.message, 'error');
        });
}

// ==================== ADD BILL ITEM ====================
function addBillItem() {
    const itemsContainer = document.getElementById('billItems');
    const newItem = document.createElement('div');
    newItem.className = 'bill-item-row item-row';
    newItem.innerHTML = `
                <input type="text" class="item-desc" placeholder="Description" onchange="calculateItemAmount(this)">
                <input type="number" class="item-qty" value="1" min="1" onchange="calculateItemAmount(this)">
                <input type="number" class="item-price" value="0" min="0" onchange="calculateItemAmount(this)">
                <input type="number" class="item-amount" value="0" readonly>
                <i class="fas fa-trash remove-item" onclick="removeItem(this)"></i>
            `;
    itemsContainer.appendChild(newItem);
}

// ==================== REMOVE BILL ITEM ====================
function removeItem(element) {
    if (document.querySelectorAll('.item-row').length > 1) {
        element.closest('.item-row').remove();
        calculateTotal();
    } else {
        showToast('At least one item is required', 'warning');
    }
}

// ==================== CALCULATE ITEM AMOUNT ====================
function calculateItemAmount(element) {
    const row = element.closest('.item-row');
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const amount = qty * price;
    row.querySelector('.item-amount').value = amount;
    calculateTotal();
}

// ==================== CALCULATE TOTAL ====================
function calculateTotal() {
    let total = 0;
    document.querySelectorAll('.item-amount').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    document.getElementById('totalAmount').textContent = total;
}

// ==================== VIEW BILL ====================
function viewBill(billId) {
    billId = Number(billId);
    const bill = billsData.find(b => Number(b.id) === billId);
    if (!bill) return;

    const content = document.getElementById('billDetailsContent');

    let paymentHtml = '';
    if (bill.payment) {
        paymentHtml = `
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h4 style="color: #155724; margin-bottom: 10px;">Payment Details</h4>
                        <p><strong>Amount Paid:</strong> ₹${bill.payment.amount}</p>
                        <p><strong>Method:</strong> ${bill.payment.method}</p>
                        <p><strong>Date:</strong> ${formatDate(bill.payment.date)}</p>
                        <p><strong>Transaction ID:</strong> ${bill.payment.transactionId || 'N/A'}</p>
                    </div>
                `;
    }

    content.innerHTML = `
                <div style="padding: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                        <div>
                            <h3 style="color: var(--primary);">Bill #${bill.id}</h3>
                            <p><strong>Status:</strong> <span class="status-badge ${bill.status}">${bill.status.toUpperCase()}</span></p>
                        </div>
                        <div style="text-align: right;">
                            <p><strong>Date:</strong> ${formatDate(bill.createdAt)}</p>
                            <p><strong>Due Date:</strong> ${formatDate(bill.dueDate)}</p>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div>
                            <p><strong>Member:</strong> ${bill.member}</p>
                            <p><strong>Flat:</strong> ${bill.flat}</p>
                        </div>
                        <div>
                            <p><strong>Bill Type:</strong> ${bill.type}</p>
                            <p><strong>Period:</strong> ${bill.period}</p>
                        </div>
                    </div>
                    
                    <h4>Bill Items</h4>
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="padding: 8px; text-align: left;">Description</th>
                                <th style="padding: 8px; text-align: right;">Qty</th>
                                <th style="padding: 8px; text-align: right;">Price</th>
                                <th style="padding: 8px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bill.items.map(item => `
                                <tr>
                                    <td style="padding: 8px;">${item.description}</td>
                                    <td style="padding: 8px; text-align: right;">${item.quantity}</td>
                                    <td style="padding: 8px; text-align: right;">₹${item.price}</td>
                                    <td style="padding: 8px; text-align: right;">₹${item.amount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="3" style="padding: 8px; text-align: right;">Total:</td>
                                <td style="padding: 8px; text-align: right;">₹${bill.amount}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    ${bill.notes ? `
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 15px;">
                            <strong>Notes:</strong>
                            <p style="margin-top: 5px;">${bill.notes}</p>
                        </div>
                    ` : ''}
                    
                    ${paymentHtml}
                </div>
            `;

    openModal('viewBillModal');
}

// ==================== EDIT BILL ====================
function editBill(billId) {
    billId = Number(billId);
    const bill = billsData.find(b => Number(b.id) === billId);
    if (!bill) return;

    // Fill the form with bill data
    document.getElementById('memberSelect').value = bill.memberId || '';
    document.getElementById('billType').value = bill.type;
    document.getElementById('billPeriod').value = bill.period;
    document.getElementById('dueDate').value = bill.dueDate;
    document.getElementById('billNotes').value = bill.notes || '';

    // Clear existing items
    document.getElementById('billItems').innerHTML = '';

    // Add bill items
    bill.items.forEach(item => {
        const itemsContainer = document.getElementById('billItems');
        const newItem = document.createElement('div');
        newItem.className = 'bill-item-row item-row';
        newItem.innerHTML = `
                    <input type="text" class="item-desc" value="${item.description}" placeholder="Description" onchange="calculateItemAmount(this)">
                    <input type="number" class="item-qty" value="${item.quantity}" min="1" onchange="calculateItemAmount(this)">
                    <input type="number" class="item-price" value="${item.price}" min="0" onchange="calculateItemAmount(this)">
                    <input type="number" class="item-amount" value="${item.amount}" readonly>
                    <i class="fas fa-trash remove-item" onclick="removeItem(this)"></i>
                `;
        itemsContainer.appendChild(newItem);
    });

    // Update total
    calculateTotal();

    // Show form
    toggleGenerateForm();

    editingBillId = billId;
    editingBillStatus = bill.status;
    showToast(`Editing bill #${billId}. Save to update.`, 'info');
}

// ==================== DELETE BILL ====================
function deleteBill(billId) {
    billId = Number(billId);
    if (confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
        fetch(`http://127.0.0.1:5000/delete_bill/${billId}`, { method: "DELETE" })
            .then(res => res.json())
            .then(data => {
                if (data.message) {
                    loadBillsData();
                    showToast(`Bill #${billId} deleted successfully`, 'warning');
                } else {
                    throw new Error(data.error || 'Failed to delete bill');
                }
            })
            .catch(err => showToast('Error deleting bill: ' + err.message, 'error'));
    }
}

// ==================== SEND REMINDER ====================
function sendReminder(billId) {
    billId = Number(billId);
    const bill = billsData.find(b => Number(b.id) === billId);
    if (!bill) return;

    // Simulate sending reminder
    showToast(`Reminder sent to ${bill.member} for bill #${billId}`, 'info');
}

// ==================== PRINT BILL ====================
function printBill(billId) {
    billId = Number(billId);
    const bill = billsData.find(b => Number(b.id) === billId);
    if (!bill) return;

    // Create printable content with embedded styles
    const printContent = `
        <html>
        <head>
            <title>Bill #${bill.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
                h1 { color: #1d4e6f; margin: 0; }
                h2 { margin: 4px 0 16px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
                th { background: #1d4e6f; color: #fff; }
                tfoot td { font-weight: bold; }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 24px;">
                <h1>UrbanSociety</h1>
                <h2>Bill #${bill.id}</h2>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Member:</strong> ${bill.member} (${bill.flat})</p>
                <p><strong>Bill Type:</strong> ${bill.type}</p>
                <p><strong>Period:</strong> ${bill.period}</p>
                <p><strong>Due Date:</strong> ${formatDate(bill.dueDate)}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align:right;">Quantity</th>
                        <th style="text-align:right;">Unit Price</th>
                        <th style="text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td style="text-align:right;">${item.quantity}</td>
                            <td style="text-align:right;">₹${item.price}</td>
                            <td style="text-align:right;">₹${item.amount}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;">Total Amount:</td>
                        <td style="text-align:right;">₹${bill.amount}</td>
                    </tr>
                </tfoot>
            </table>
            
            ${bill.notes ? `
                <div style="margin-top: 24px; padding: 12px; background: #f8f9fa;">
                    <strong>Notes:</strong> ${bill.notes}
                </div>
            ` : ''}
            
            <div style="margin-top: 32px; text-align: center; color: #555;">
                <p>This is a computer generated bill. No signature required.</p>
                <p>For any queries, contact: accounts@urbansociety.com</p>
            </div>
        </body>
        </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Popup blocked. Allow popups to print.', 'warning');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// ==================== PRINT BILL DETAILS (from modal) ====================
function printBillDetails() {
    const billId = document.getElementById('paymentBillId').textContent;
    if (billId && billId !== '-') {
        printBill(billId);
    }
}

// ==================== OPEN PAYMENT MODAL ====================
function openPaymentModal(billId) {
    billId = Number(billId);
    const bill = billsData.find(b => Number(b.id) === billId);
    if (!bill) return;

    selectedBillForPayment = bill;

    document.getElementById('paymentBillId').textContent = bill.id;
    document.getElementById('paymentMember').textContent = bill.member;
    document.getElementById('paymentAmount').textContent = bill.amount;
    document.getElementById('paymentAmountInput').value = bill.amount - (bill.payment?.amount || 0);

    // Reset payment method
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    selectedPaymentMethod = null;

    openModal('paymentModal');
}

// ==================== SELECT PAYMENT METHOD ====================
function selectPaymentMethod(element, method) {
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    element.classList.add('selected');
    selectedPaymentMethod = method;
}

// ==================== RECORD PAYMENT ====================
function recordPayment() {
    if (!selectedBillForPayment) {
        showToast('No bill selected', 'error');
        return;
    }

    if (!selectedPaymentMethod) {
        showToast('Please select a payment method', 'warning');
        return;
    }

    const paymentAmount = parseFloat(document.getElementById('paymentAmountInput').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const transactionId = document.getElementById('transactionId').value;
    const notes = document.getElementById('paymentNotes').value;

    if (!paymentAmount || paymentAmount <= 0) {
        showToast('Please enter a valid payment amount', 'error');
        return;
    }

    const bill = selectedBillForPayment;
    const remainingAmount = bill.amount - (bill.payment?.amount || 0);

    if (paymentAmount > remainingAmount) {
        showToast('Payment amount cannot exceed the due amount', 'error');
        return;
    }

    // Determine new status
    const totalPaid = (bill.payment?.amount || 0) + paymentAmount;
    let newStatus = 'pending';
    if (totalPaid >= bill.amount) {
        newStatus = 'paid';
    } else if (totalPaid > 0) {
        newStatus = 'partial';
    }

    // Update bill status in database
    updateBillStatusInDatabase(bill.id, newStatus)
        .then(result => {
            // Close modal
            closeModal('paymentModal');

            // Show success message
            showToast(`Payment of ₹${paymentAmount} recorded for bill #${bill.id}`);
        })
        .catch(error => {
            showToast('Error recording payment: ' + error.message, 'error');
        });
}

// ==================== MODAL FUNCTIONS ====================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'paymentModal') {
        selectedBillForPayment = null;
        selectedPaymentMethod = null;
    }
}

// ==================== TOGGLE GENERATE FORM ====================
function toggleGenerateForm() {
    document.getElementById('generateBillForm').classList.toggle('active');
}

// ==================== GO BACK ====================
function goBack() {
    window.history.back();
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        window.location.href = '/';
    }
}
