// ======================== LOGIN SCRIPT ========================
(function () {

    const tabAdmin = document.getElementById('tabAdmin');
    const tabMember = document.getElementById('tabMember');
    const adminExtra = document.getElementById('adminExtraField');
    const memberExtra = document.getElementById('memberExtraField');
    const btnText = document.getElementById('btnText');
    const roleHint = document.getElementById('roleHint');
    const loginForm = document.getElementById('loginForm');

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const adminCodeInput = document.getElementById('adminCode');
    const flatIdInput = document.getElementById('flatId');

    let currentRole = 'admin';

    // ======================== SWITCH TABS ========================
    function setActiveTab(role) {

        if (role === 'admin') {
            tabAdmin.classList.add('active');
            tabMember.classList.remove('active');

            adminExtra.classList.remove('hidden-field');
            memberExtra.classList.add('hidden-field');

            btnText.innerText = 'Login as Admin';
            roleHint.innerHTML = '<i class="fas fa-shield"></i> You are logging in as <strong>Administrator</strong>';

            // Demo values
            emailInput.value = 'admin@urbansociety.com';
            passwordInput.value = '123456';
            adminCodeInput.value = 'ADMIN007';
            flatIdInput.value = '';

        } else {

            tabMember.classList.add('active');
            tabAdmin.classList.remove('active');

            adminExtra.classList.add('hidden-field');
            memberExtra.classList.remove('hidden-field');

            btnText.innerText = 'Login as Member';
            roleHint.innerHTML = '<i class="fas fa-user"></i> You are logging in as <strong>Member</strong>';

            // Demo values
            emailInput.value = 'mnthn117@gmail.com';
            passwordInput.value = '123456';
            flatIdInput.value = 'M-302';
            adminCodeInput.value = '';
        }

        currentRole = role;
    }

    // ======================== EVENTS ========================
    tabAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab('admin');
    });

    tabMember.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab('member');
    });

    // Default
    setActiveTab('admin');

    // ======================== LOGIN SUBMIT ========================
    loginForm.addEventListener('submit', function (event) {

        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const flatId = flatIdInput.value.trim();

        // ================= VALIDATION =================
        if (!email || !password) {
            alert('❌ Enter email and password');
            return;
        }

        if (currentRole === 'member' && !flatId) {
            alert('❌ Enter Flat ID for member login');
            return;
        }

        // ================= API CALL =================
        fetch("https://urban-society-9i6a.onrender.com/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password,
                role: currentRole,
                flatId: flatId
            })
        })

        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.error || "Login failed");
                });
            }
            return res.json();
        })

        .then(data => {

            // Store common data
            sessionStorage.setItem('userRole', currentRole);
            sessionStorage.setItem('userEmail', email);

            // ================= ADMIN =================
            if (currentRole === 'admin') {

                sessionStorage.setItem('userName', 'Administrator');
                sessionStorage.setItem('block', 'Admin');
                sessionStorage.removeItem('memberId');

                window.location.href = "/admin/html/dashboard.html";

            } 
            // ================= MEMBER =================
            else {

                const memberName = data.name || email.split('@')[0];
                const memberFlat = (data.flatId || flatId).replace(/\s+/g, '');

                if (data.memberId) {
                    sessionStorage.setItem('memberId', data.memberId);
                }

                sessionStorage.setItem('userName', memberName);
                sessionStorage.setItem('block', memberFlat);

                window.location.href = "/member/html/member_dashboard.html";
            }

        })

        .catch(err => {
            alert(err.message);
            console.error("❌ Login error:", err);
        });

    });

})();