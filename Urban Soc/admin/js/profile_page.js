// ======================== COMMENT ========================\n// profile_page.js — logic for admin profile_page page (included via its HTML)\n// Admin profile page logic
(function(){
    const form = document.getElementById('adminProfileForm');
    const preview = document.getElementById('avatarPreview');

    function loadProfile(){
        const dataRaw = localStorage.getItem('admin_profile');
        const data = dataRaw ? JSON.parse(dataRaw) : {};
        document.getElementById('profileName').value = data.name || (sessionStorage.getItem('userName') || 'Admin');
        document.getElementById('profileEmail').value = data.email || (sessionStorage.getItem('userEmail') || '');
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
        const phone = document.getElementById('profilePhone').value.trim();
        const file = document.getElementById('profilePhoto').files[0];
        let photo = preview.src && preview.style.display !== 'none' ? preview.src : null;
        if(file){
            photo = await toBase64(file);
        }
        const payload = {name,email,phone,photo,role:'Administrator'};
        localStorage.setItem('admin_profile', JSON.stringify(payload));
        sessionStorage.setItem('userName', name);
        sessionStorage.setItem('userEmail', email);
        applyAdminAvatar();
        showNotification('Profile saved','success');
    });

    document.getElementById('profilePhoto').addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(file){
            preview.src = await toBase64(file);
            preview.style.display='block';
        }
    });

    window.resetProfile = function(){
        localStorage.removeItem('admin_profile');
        document.getElementById('profilePhoto').value = '';
        preview.style.display='none';
        loadProfile();
        applyAdminAvatar();
    }

    loadProfile();
})();
