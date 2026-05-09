// Ganti dengan URL Google Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbxwDSadUhCGm_zuNB5S-_KqgQWM-BrGTzh_5Xn1KoWV9PGgcs60LUR4V1YU3PWO2EFV/exec";

function showPage(pageId) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    // Tampilkan halaman terpilih
    document.getElementById('page-' + pageId).classList.remove('hidden');
    
    // Update warna icon di Bottom Nav (Simple toggle)
    const navButtons = document.querySelectorAll('.glass-nav button');
    navButtons.forEach(btn => btn.classList.replace('text-blue-400', 'text-white/50'));
}

async function doLogin() {
    // ... logika fetch login sama seperti sebelumnya ...
    // Jika sukses:
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    if(currentUser.role === "Admin") {
        document.getElementById('admin-links').classList.remove('hidden');
    }
    initCamera();
}

// Tambahkan logika takeAbsen & initCamera dari kode sebelumnya
