// Member profile page logic
(function(){
    function toast(msg,type){
        if (typeof showToast === 'function') { showToast(msg,type); }
        else alert(msg);
    }
    if (!ensureMemberAuth()) return;
    const form = document.getElementById('memberProfileForm');
    const preview = document.getElementById('avatarPreview');
    const memberId = sessionStorage.getItem('memberId');

    function loadProfile(){
        const dataRaw = memberId ? localStorage.getItem(`member_profile_${memberId}`) : null;
        const data = dataRaw ? JSON.parse(dataRaw) : {};
        document.getElementById('profileName').value = data.name || (sessionStorage.getItem('userName') || 'Member');
        document.getElementById('profileEmail').value = data.email || (sessionStorage.getItem('userEmail') || '');
        document.getElementById('profileFlat').value = data.flat || (sessionStorage.getItem('flatId') || '');
        document.getElementById('profilePhone').value = data.phone || '';
        if(data.photo){
            preview.src = data.photo;
            preview.style.display='block';
        } else {
            preview.style.display='none';
        }
    }

    function toBase64(file){
        return new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(reader.result);
            reader.onerror=reject;
            reader.readAsDataURL(file);
        });
    }

    form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();
        const flat = document.getElementById('profileFlat').value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        const file = document.getElementById('profilePhoto').files[0];
        let photo = preview.src && preview.style.display !== 'none' ? preview.src : null;
        if(file){ photo = await toBase64(file); }
        const payload = {name,email,flat,phone,photo,role:'Resident'};
        if(memberId){ localStorage.setItem(`member_profile_${memberId}`, JSON.stringify(payload)); }
        sessionStorage.setItem('userName', name);
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('flatId', flat);
        applyMemberAvatar();
        toast('Profile saved','success');
    });

    document.getElementById('profilePhoto').addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(file){
            preview.src = await toBase64(file);
            preview.style.display='block';
        }
    });

    window.resetMemberProfile = function(){
        if(memberId){ localStorage.removeItem(`member_profile_${memberId}`); }
        document.getElementById('profilePhoto').value = '';
        preview.style.display='none';
        loadProfile();
        applyMemberAvatar();
    }

    loadProfile();
})();
// ======================== COMMENT ========================
// member_profile.js — member profile display and update form handling
