// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    window.toast = (msg,type='info') => {
        if (typeof showToast === 'function') { showToast(msg,type); }
        else alert(msg);
    };
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'member') {
        window.location.href = '/';
        return;
    }

    const memberId = sessionStorage.getItem('memberId');
    if (!memberId) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName') || 'Member';
    document.getElementById('userName').textContent = userName;

    loadBills(memberId);
    window._memberId = memberId;

    // Auto-refresh
    const REFRESH_MS = 10000;
    setInterval(() => loadBills(memberId), REFRESH_MS);

    const refreshBtn = document.getElementById('refreshBills');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadBills(memberId));
    }

    const payModal = document.getElementById('payModal');
    if (payModal) {
        payModal.addEventListener('click', (e) => {
            if (e.target === payModal) closePayModal();
        });
    }
});

// ==================== LOAD BILLS ====================
function loadBills(memberId) {
    const container = document.getElementById('billsContainer');
    const url = `http://127.0.0.1:5000/get_member_bills?member_id=${encodeURIComponent(memberId)}`;

    fetch(url)
        .then(res => res.json())
        .then(bills => renderBills(bills))
        .catch(err => {
            console.error('Error loading bills', err);
            container.innerHTML = `<div class="empty"><i class="fas fa-exclamation-circle"></i> Unable to load bills right now.</div>`;
        });
}

// ==================== RENDER ====================
function renderBills(bills) {
    const container = document.getElementById('billsContainer');

    if (!bills || bills.length === 0) {
        container.innerHTML = `<div class="empty"><i class="fas fa-receipt"></i> No bills yet.</div>`;
        return;
    }

    container.innerHTML = bills.map(bill => `
        <div class="card">
            <h3>${bill.description || 'Bill'}</h3>
            <div class="meta">Due: ${formatDate(bill.due_date)} • Flat ${bill.flat_id || ''}</div>
            <div class="amount">₹${Number(bill.amount || 0).toFixed(2)}</div>
            <span class="status ${bill.status}">${(bill.status || 'pending').toUpperCase()}</span>
            <div class="actions" style="margin-top:10px; display:flex; gap:8px;">
                ${bill.status !== 'paid' ? `<button class="btn btn-primary" onclick='openPayModal(${JSON.stringify(bill.id)})'>Pay</button>` : ''}
                <button class="btn btn-secondary" onclick='printBill(${JSON.stringify(bill.id)})'>Print</button>
            </div>
        </div>
    `).join('');
}

// ==================== UTILS ====================
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}

// ==================== PAYMENT FLOW ====================
let payContext = { billId: null, amount: 0, title: '' };

function openPayModal(billId) {
    billId = Number(billId);
    fetch(`http://127.0.0.1:5000/get_member_bills?member_id=${encodeURIComponent(window._memberId || '')}`)
        .then(r => r.json())
        .then(list => {
            const bill = (list || []).find(b => Number(b.id) === billId);
            if (!bill) return;
            payContext = { billId, amount: bill.amount, title: bill.description || 'Bill' };
            document.getElementById('payBillTitle').textContent = payContext.title;
            document.getElementById('payBillAmount').textContent = Number(payContext.amount || 0).toFixed(2);
            const modal = document.getElementById('payModal');
            if (modal) modal.style.display = 'flex';
        });
}

function closePayModal() {
    const modal = document.getElementById('payModal');
    if (modal) modal.style.display = 'none';
}

function confirmPay() {
    if (!payContext.billId) return;
    fetch("http://127.0.0.1:5000/pay_bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bill_id: payContext.billId, member_id: window._memberId, method: document.getElementById('payMethod').value })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            toast('Payment recorded','success');
            closePayModal();
            loadBills(window._memberId);
        })
        .catch(err => {
            console.error(err);
            toast('Payment failed: ' + err.message, 'error');
        });
}

// ==================== PRINT BILL ====================
function printBill(billId) {
    billId = Number(billId);
    fetch(`http://127.0.0.1:5000/get_member_bills?member_id=${encodeURIComponent(window._memberId || '')}`)
        .then(r => r.json())
        .then(list => {
            const bill = (list || []).find(b => Number(b.id) === billId);
            if (!bill) {
                toast('Bill not found', 'error');
                return;
            }
            const content = `
            <html><head><title>Bill #${bill.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
                h1 { color: #1d4e6f; margin: 0; }
                h2 { margin: 4px 0 16px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
                th { background: #1d4e6f; color: #fff; }
                tfoot td { font-weight: bold; }
            </style></head><body>
                <div style="text-align:center;margin-bottom:24px;">
                    <h1>UrbanSociety</h1>
                    <h2>Bill #${bill.id}</h2>
                </div>
                <div style="margin-bottom:20px;">
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Member:</strong> ${bill.member_name || ''} (${bill.flat_id || ''})</p>
                    <p><strong>Bill Type:</strong> ${bill.description || 'Bill'}</p>
                    <p><strong>Due Date:</strong> ${formatDate(bill.due_date)}</p>
                    <p><strong>Status:</strong> ${(bill.status || '').toUpperCase()}</p>
                </div>
                <table>
                    <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
                    <tbody><tr><td>${bill.description || 'Bill'}</td><td style="text-align:right;">₹${Number(bill.amount||0).toFixed(2)}</td></tr></tbody>
                    <tfoot><tr><td style="text-align:right;">Total:</td><td style="text-align:right;">₹${Number(bill.amount||0).toFixed(2)}</td></tr></tfoot>
                </table>
                <div style="margin-top:32px;text-align:center;color:#555;">This is a computer generated bill.</div>
            </body></html>`;
            const w = window.open('', '_blank');
            if (!w) { showToast('Allow popups to print', 'warning'); return; }
            w.document.open(); w.document.write(content); w.document.close(); w.focus(); w.print();
        });
}
// ======================== COMMENT ========================
// member_bills.js — logic for member bills list, pay modal, and print view
