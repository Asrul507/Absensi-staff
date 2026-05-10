// ============================================
// GENIUS PRESENCE - SUPABASE FULL VERSION
// ============================================

const SUPABASE_URL = "https://kuldbrivmpqpoyeilbav.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bGRicml2bXBxcG95ZWlsYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTI4NDMsImV4cCI6MjA5Mzk2ODg0M30.je9yMizaJs5OJ4yuaxnw2vwPeGy1F_0j75SMU1IZZso";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser  = null;
let cameraStream = null;
let currentPage  = "absensi";
let allShifts    = [];

// ============================================
// INIT & AUTH
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
        try { 
            currentUser = JSON.parse(saved); 
            showApp(); 
        } catch(e) { 
            localStorage.removeItem("currentUser"); 
            showLogin(); 
        }
    } else { showLogin(); }
});

async function login() {
    const email = (document.getElementById("username").value || "").trim();
    const password = (document.getElementById("password").value || "").trim();
    if (!email || !password) return showToast("Isi semua field!", "error");
    
    showLoading(true);
    const { data, error } = await _supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

    if (data && data.status_akun === 'Aktif') {
        currentUser = { id: data.id_karyawan, nama: data.nama_lengkap, email: data.email, role: data.role };
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        showApp();
    } else {
        showToast("Login Gagal atau Akun Nonaktif", "error");
    }
    showLoading(false);
}

function showApp() {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appPage").style.display   = "block";
    document.getElementById("userName").textContent    = currentUser.nama;
    renderSidebar(); renderBottomNav(); navigateTo("absensi");
}

// ============================================
// NAVIGATION SYSTEM
// ============================================
function navigateTo(page) {
    currentPage = page; closeSidebar(); stopCamera();
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById("nav-" + page); if (btn) btn.classList.add("active");
    
    const content = document.getElementById("content");
    content.innerHTML = "";

    switch(page) {
        case "absensi": renderAbsensi(); break;
        case "riwayat": renderRiwayat(); break;
        case "monitoring": renderMonitoring(); break;
        case "kelola-user": renderKelolaUser(); break;
        case "profil": renderProfil(); break;
        // Tambahkan case lain sesuai kebutuhan menu kamu
    }
}

// ============================================
// CORE FEATURE: ABSENSI (Insert & Update)
// ============================================
async function renderAbsensi() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("content").innerHTML = `
        <div class="page-header">
            <h2><i class="fa-solid fa-fingerprint"></i> Absensi</h2>
            <p>${new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long'})}</p>
        </div>
        <div id="status-absensi-box" class="card">Mengecek database...</div>
        <div id="absensi-action-box"></div>`;
    
    const { data } = await _supabase.from('absensi').select('*').eq('nama', currentUser.nama).eq('tanggal', today).single();
    
    const actionBox = document.getElementById("absensi-action-box");
    const statusBox = document.getElementById("status-absensi-box");

    if (!data) {
        statusBox.innerHTML = `<div class="status-tile pending">Belum Absen Masuk</div>`;
        actionBox.innerHTML = buildAbsenUI("masuk");
    } else if (!data.waktu_pulang) {
        statusBox.innerHTML = `<div class="status-tile done">Masuk: ${data.waktu_masuk}</div>`;
        actionBox.innerHTML = buildAbsenUI("pulang");
    } else {
        statusBox.innerHTML = `<div class="card absensi-done-card">✅ Absensi Selesai</div>`;
    }
}

function buildAbsenUI(tipe) {
    return `<div class="card">
        <h3>Absen ${tipe.toUpperCase()}</h3>
        <div class="camera-wrap"><video id="webcam" autoplay playsinline></video></div>
        <canvas id="cameraCanvas" style="display:none;"></canvas>
        <button onclick="eksekusiAbsen('${tipe}')" class="btn-absensi">Kirim Absen</button>
    </div>`;
    setTimeout(() => startWebcam(), 100);
}

async function eksekusiAbsen(tipe) {
    showLoading(true);
    try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        const video = document.getElementById("webcam");
        const canvas = document.getElementById("cameraCanvas");
        canvas.width = 400; canvas.height = 300;
        canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.6));

        const fileName = `${tipe}_${currentUser.nama}_${Date.now()}.jpg`;
        await _supabase.storage.from('foto-absensi').upload(fileName, blob);
        const { data: urlData } = _supabase.storage.from('foto-absensi').getPublicUrl(fileName);

        const now = new Date();
        const jam = now.toLocaleTimeString('id-ID', { hour12: false });
        const tgl = now.toISOString().split('T')[0];

        if (tipe === "masuk") {
            await _supabase.from('absensi').insert([{
                nama: currentUser.nama, tanggal: tgl, waktu_masuk: jam,
                lat_masuk: pos.coords.latitude.toString(), lng_masuk: pos.coords.longitude.toString(),
                foto_masuk: urlData.publicUrl, status_masuk: 'Hadir'
            }]);
        } else {
            await _supabase.from('absensi').update({
                waktu_pulang: jam, lat_pulang: pos.coords.latitude.toString(),
                lng_pulang: pos.coords.longitude.toString(), foto_pulang: urlData.publicUrl, status_pulang: 'Pulang'
            }).eq('nama', currentUser.nama).eq('tanggal', tgl);
        }
        showToast("Berhasil!", "success");
        renderAbsensi();
    } catch(e) { showToast(e.message, "error"); }
    showLoading(false);
}

// ============================================
// ADMIN FEATURE: MONITORING (Real-time)
// ============================================
async function renderMonitoring() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("content").innerHTML = `<h3>Monitoring Hari Ini</h3><div id="monitor-list"></div>`;
    
    const { data } = await _supabase.from('absensi').select('*').eq('tanggal', today);
    const list = document.getElementById("monitor-list");
    
    if (data) {
        list.innerHTML = data.map(u => `
            <div class="absensi-card">
                <img src="${u.foto_masuk}" class="absensi-foto">
                <div class="absensi-card-body">
                    <b>${u.nama}</b><br>
                    <small>In: ${u.waktu_masuk} | Out: ${u.waktu_pulang || '-'}</small>
                </div>
            </div>
        `).join("");
    }
}

// ============================================
// ADMIN FEATURE: KELOLA USER
// ============================================
async function renderKelolaUser() {
    document.getElementById("content").innerHTML = `<h3>Kelola User</h3><div id="user-list"></div>`;
    const { data } = await _supabase.from('users').select('*');
    const list = document.getElementById("user-list");
    if(data) {
        list.innerHTML = data.map(u => `
            <div class="user-card">
                <b>${u.nama_lengkap}</b> (${u.role})<br>
                <small>${u.email}</small>
            </div>
        `).join("");
    }
}

// ============================================
// HELPERS (Toast, Loading, Camera)
// ============================================
async function startWebcam() {
    try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById("webcam").srcObject = cameraStream; } catch(e) {}
}
function stopCamera() { if(cameraStream) cameraStream.getTracks().forEach(t => t.stop()); }
function showLoading(s) { document.getElementById("loading-overlay").style.display = s ? "flex" : "none"; }
function showToast(m, t) { 
    const container = document.getElementById("toast-container");
    const div = document.createElement("div");
    div.className = `toast toast-${t} show`;
    div.innerHTML = m;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}
// Render Sidebar & BottomNav tetap menggunakan fungsi yang sudah kamu buat sebelumnya
