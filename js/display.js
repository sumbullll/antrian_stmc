// js/display.js - TV Display Ruang Tunggu Donor Darah STMC

let displayTim = null;
let lastUpdate = null;
let isAudioInitialized = false;
let pollInterval = null;

// Helper: Menentukan Prefix, Kode Lengkap, Warna Karcis, dan Label Tim
function getTicketInfo(item) {
    const kode = (item.kode_tim || '').toUpperCase();
    const metode = (item.metode_input || '').toUpperCase();
    const numStr = String(item.nomor_urut).padStart(3, '0');

    if (kode === 'P') {
        return {
            prefix: 'P',
            fullCode: `P-${numStr}`,
            badgeType: 'UTD Pangkep',
            teamVoice: 'UTD Pangkep',
            color: '#fd7e14',        // Oranye Khas Karcis Pangkep
            pulseClass: 'calling-pulse-P',
            bgSoft: '#fffaf5',
            borderSoft: '#fed7aa',
            badgeBg: '#fff3e0',
            badgeText: '#d9480f'
        };
    } else if (kode === 'MM' || (kode === 'M' && metode === 'MANUAL')) {
        return {
            prefix: 'MM',
            fullCode: `MM-${numStr}`,
            badgeType: 'Makassar (Manual)',
            teamVoice: 'PMI Makassar',
            color: '#1976D2',        // Biru Khas Karcis MM Manual
            pulseClass: 'calling-pulse-MM',
            bgSoft: '#f0f7ff',
            borderSoft: '#bae6fd',
            badgeBg: '#e0f2fe',
            badgeText: '#0369a1'
        };
    } else { // 'MO' atau 'M' dengan metode QR/Online
        return {
            prefix: 'MO',
            fullCode: `MO-${numStr}`,
            badgeType: 'Makassar (Online)',
            teamVoice: 'PMI Makassar',
            color: '#D32F2F',        // Merah Khas Karcis MO Online
            pulseClass: 'calling-pulse-MO',
            bgSoft: '#fff5f5',
            borderSoft: '#fecaca',
            badgeBg: '#fee2e2',
            badgeText: '#b91c1c'
        };
    }
}

// Inisialisasi Suara TTS (Text-to-Speech)
let voices = [];
function populateVoiceList() {
    voices = window.speechSynthesis.getVoices();
}
populateVoiceList();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// Trick untuk Autoplay Policy Browser
const btnInitAudio = document.getElementById('btn-init-audio');
if (btnInitAudio) {
    btnInitAudio.addEventListener('click', initAudio);
}

function initAudio() {
    if (!isAudioInitialized) {
        const msg = new SpeechSynthesisUtterance('');
        msg.volume = 0;
        window.speechSynthesis.speak(msg);
        isAudioInitialized = true;
        console.log('Audio TTS initialized');
    }
}

// --- FUNGSI UTAMA: MENYETEL DISPLAY TV ---
window.setDisplay = function(tim) {
    displayTim = tim;
    
    // Simpan pilihan ke LocalStorage agar reload tetap berada di layar yang sama
    localStorage.setItem('displayTim', tim);
    
    // Update parameter URL tanpa reload agar bisa dibookmark/dishare
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tim', tim);
    window.history.replaceState(null, '', newUrl.toString());

    // Sembunyikan modal pilihan
    const overlay = document.getElementById('config-overlay');
    if (overlay) overlay.classList.add('d-none');
    
    // Terapkan Tema Header dan Judul Layar
    const header = document.getElementById('header-bar');
    const title = document.getElementById('tv-title');
    const subtitle = document.getElementById('tv-subtitle');
    
    header.classList.remove('theme-pangkep', 'theme-makassar');
    
    if (tim === 'P') {
        header.classList.add('theme-pangkep');
        title.innerText = 'UTD Pangkep & STMC';
        if (subtitle) {
            subtitle.innerText = 'Karcis Oranye (P-001 s/d P-200)';
            subtitle.className = 'badge bg-warning-subtle text-warning-emphasis fw-bold px-3 py-1';
        }
    } else {
        header.classList.add('theme-makassar');
        title.innerText = 'PMI Makassar & STMC';
        if (subtitle) {
            subtitle.innerText = 'Satu Layar: MM Biru (Manual) & MO Merah (Online)';
            subtitle.className = 'badge bg-danger-subtle text-danger-emphasis fw-bold px-3 py-1';
        }
    }

    // Inisialisasi audio jika belum
    initAudio();
    
    // Mulai Polling Realtime ke Supabase setiap 2 detik
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchCurrentDisplay, 2000);
    fetchCurrentDisplay();
};

// Fungsi Ganti Layar (Kembali Memilih Layar)
window.gantiLayar = function() {
    localStorage.removeItem('displayTim');
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('tim');
    window.history.replaceState(null, '', newUrl.toString());

    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    const overlay = document.getElementById('config-overlay');
    if (overlay) overlay.classList.remove('d-none');
};

// Cek Otomatis Saat Halaman Dimuat: Tetap di Pilihan Terakhir!
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramTim = urlParams.get('tim');
    const savedTim = localStorage.getItem('displayTim');
    
    // Prioritaskan parameter URL, jika tidak ada gunakan localStorage
    const targetTim = (paramTim === 'P' || paramTim === 'M') ? paramTim : 
                      ((savedTim === 'P' || savedTim === 'M') ? savedTim : null);

    if (targetTim) {
        window.setDisplay(targetTim);
    } else {
        // Tampilkan modal pemilihan jika belum ada tim yang dipilih
        const overlay = document.getElementById('config-overlay');
        if (overlay) overlay.classList.remove('d-none');
    }
});

let lastWaitingHTML = '';

// --- FETCH DATA DARI SUPABASE ---
async function fetchCurrentDisplay() {
    if (!displayTim) return;

    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        
        // Filter tim: Jika Makassar ('M'), ambil data 'M', 'MM', dan 'MO' sekaligus
        const timFilter = displayTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

        // 1. Fetch antrian yang sedang dipanggil (maksimal 4 di TV)
        const panggilPromise = supabaseClient
            .from('antrian')
            .select('*')
            .in('kode_tim', timFilter)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', startIso)
            .order('waktu_panggil', { ascending: false })
            .limit(4);
            
        // 2. Fetch antrian yang sedang menunggu (hingga 1000 antrian)
        const tungguPromise = supabaseClient
            .from('antrian')
            .select('*')
            .in('kode_tim', timFilter)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', startIso)
            .order('waktu_ambil', { ascending: true })
            .limit(1000);

        const [resPanggil, resTunggu] = await Promise.all([panggilPromise, tungguPromise]);

        // Render Antrian Aktif (Kiri)
        updateUI(resPanggil.data || []);

        // Audio Announcement dipicu jika ada panggilan baru yang paling atas
        if (resPanggil.data && resPanggil.data.length > 0) {
            const latestItem = resPanggil.data[0];
            if (lastUpdate !== latestItem.waktu_panggil) {
                speakAnnouncement(latestItem);
                lastUpdate = latestItem.waktu_panggil;
            }
        }
        
        // Render Daftar Menunggu (Kanan)
        const waitingItems = resTunggu.data || [];
        const waitingCountEl = document.getElementById('tv-waiting-count');
        if (waitingCountEl) {
            waitingCountEl.innerText = `${waitingItems.length} antrian`;
        }

        const waitingListEl = document.getElementById('tv-waiting-list');
        if (waitingListEl) {
            let listHTML = '';

            if (waitingItems.length > 0) {
                listHTML = waitingItems.map(q => {
                    const info = getTicketInfo(q);
                    const nama = (q.nama_pendonor && q.nama_pendonor !== '-') ? q.nama_pendonor : 'Peserta Donor';
                    
                    return `
                        <div class="py-2 px-3 border-bottom border-light-subtle d-flex justify-content-between align-items-center">
                            <div class="text-start d-flex align-items-center">
                                <span class="fs-4 fw-bolder" style="color: ${info.color}; letter-spacing: 0.5px;">${info.fullCode}</span>
                                ${displayTim === 'M' ? `<span class="badge ms-2" style="background-color: ${info.badgeBg}; color: ${info.badgeText}; font-size: 0.75rem;">${info.prefix === 'MM' ? 'Manual' : 'Online'}</span>` : ''}
                            </div>
                            <div class="text-end text-truncate" style="max-width: 55%;">
                                <span class="fs-6 fw-semibold text-secondary">${nama}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                listHTML = `<div class="py-5 text-muted fw-normal">Belum ada antrian menunggu...</div>`;
            }

            if (listHTML !== lastWaitingHTML) {
                lastWaitingHTML = listHTML;
                waitingListEl.innerHTML = listHTML;
            }
        }
    } catch (err) {
        console.error('Error fetching display data:', err);
    }
}

// --- AUTO-SCROLL HALUS DAFTAR MENUNGGU ---
let isPausedAtBottom = false;
setInterval(() => {
    const scrollBox = document.getElementById('waiting-scroll-container');
    if (scrollBox && scrollBox.scrollHeight > scrollBox.clientHeight && !isPausedAtBottom) {
        scrollBox.scrollTop += 1;
        if (scrollBox.scrollTop >= scrollBox.scrollHeight - scrollBox.clientHeight - 2) {
            isPausedAtBottom = true;
            setTimeout(() => {
                scrollBox.scrollTop = 0;
                isPausedAtBottom = false;
            }, 2500);
        }
    }
}, 45);

// --- RENDER GRID ANTRIAN AKTIF (KIRI) ---
function updateUI(items) {
    const grid = document.getElementById('tv-active-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-muted my-auto">
                <h1 class="display-1 fw-bold text-secondary">--</h1>
                <h3 class="fs-3 text-muted">Silakan Menunggu Panggilan</h3>
            </div>`;
        return;
    }

    grid.innerHTML = ''; // Kosongkan grid

    // Batasi maksimal 4 antrian aktif di layar TV agar grid proporsional
    const displayItems = items.slice(0, 4);
    const colClass = displayItems.length === 1 ? 'col-12' : 'col-6';

    displayItems.forEach((item, index) => {
        const isLatest = index === 0; // Paling baru dipanggil
        const info = getTicketInfo(item);
        const nama = (item.nama_pendonor && item.nama_pendonor !== '-') ? item.nama_pendonor : 'Peserta Donor';
        
        // Ukuran font adaptif berdasarkan jumlah kartu di layar
        const numFontSize = displayItems.length > 2 ? '5vw' : (displayItems.length === 2 ? '6.8vw' : '9.5vw');
        const nameFontSize = displayItems.length > 2 ? '1.6vw' : (displayItems.length === 2 ? '2vw' : '2.8vw');

        let statusBadgeHTML = '';
        let cardStyle = '';
        let cardClass = '';

        if (isLatest) {
            // Nomor yang BARU DIPANGGIL: Efek glowing pulse border & badge mencolok
            cardClass = `card ${info.pulseClass}`;
            cardStyle = `
                background-color: ${info.bgSoft};
                border: 4px solid ${info.color} !important;
                border-radius: 20px;
                box-shadow: 0 12px 30px rgba(0,0,0,0.12);
            `;
            statusBadgeHTML = `
                <div class="badge badge-status-panggil pulse-badge text-white px-3 py-2 mb-2" style="background-color: ${info.color}; font-size: ${displayItems.length > 2 ? '1vw' : '1.2vw'};">
                    🔔 SEDANG DIPANGGIL
                </div>
            `;
        } else {
            // Nomor yang SEDANG DILAYANI di bed lainnya: Tenang & rapi
            cardClass = 'card shadow-sm';
            cardStyle = `
                background-color: #ffffff;
                border: 2.5px solid ${info.borderSoft} !important;
                border-radius: 18px;
            `;
            statusBadgeHTML = `
                <div class="badge badge-status-layani px-3 py-1 mb-2" style="font-size: ${displayItems.length > 2 ? '0.85vw' : '1vw'};">
                    🩺 SEDANG DILAYANI
                </div>
            `;
        }

        const cardHTML = `
            <div class="${colClass} p-2 my-auto">
                <div class="${cardClass}" style="${cardStyle}">
                    <div class="card-body py-3 px-2 d-flex flex-column justify-content-center align-items-center">
                        ${statusBadgeHTML}
                        <div class="fw-bold mb-1" style="color: ${info.color}; font-size: ${displayItems.length > 2 ? '1vw' : '1.2vw'}; letter-spacing: 0.5px;">
                            ${info.badgeType}
                        </div>
                        <div style="font-size: ${numFontSize}; font-weight: 900; line-height: 1; color: ${info.color}; letter-spacing: 1.5px;">
                            ${info.fullCode}
                        </div>
                        <div style="font-size: ${nameFontSize}; font-weight: 700; color: #1e293b; margin-top: 10px; word-break: break-word;">
                            ${nama}
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// --- JAM DIGITAL ---
setInterval(() => {
    const clockObj = new Date();
    const timeString = clockObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = clockObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const clockEl = document.getElementById('tv-clock');
    if (clockEl) clockEl.innerText = `${dateString}  |  ${timeString}`;
}, 1000);

// --- BEL TING-TONG (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playChime() {
    return new Promise((resolve) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        // Nada 1 (Ting)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        gain1.gain.setValueAtTime(0, audioCtx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 1);

        // Nada 2 (Tong)
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            gain2.gain.setValueAtTime(0, audioCtx.currentTime);
            gain2.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 1.5);
        }, 500);

        // Beri jeda 1.4 detik sebelum TTS bersuara
        setTimeout(resolve, 1400);
    });
}

// Helper: Ubah Kode Karcis agar Diucapkan Jelas oleh Suara TTS
function formatCodeForSpeech(fullCode) {
    // Contoh input: "MM-005" -> "M M, kosong kosong lima"
    // Contoh input: "MO-012" -> "M O, kosong satu dua"
    // Contoh input: "P-001"  -> "P, kosong kosong satu"
    const parts = fullCode.split('-');
    const prefixSpoken = parts[0].split('').join(' '); // "M M" atau "M O" atau "P"
    const numberDigits = (parts[1] || '').split('').map(d => {
        if (d === '0') return 'kosong';
        return d;
    }).join(' ');

    return `${prefixSpoken}, ${numberDigits}`;
}

// --- PANGGILAN SUARA (TTS) ---
async function speakAnnouncement(item) {
    if (!('speechSynthesis' in window)) return;

    // Putar bel Ting-Tong
    await playChime();

    const info = getTicketInfo(item);
    const spokenCode = formatCodeForSpeech(info.fullCode);
    const nama = (item.nama_pendonor || '').trim();

    let text = '';
    if (nama && nama !== '-' && !nama.toLowerCase().startsWith('peserta ')) {
        text = `Nomor antrian, ${spokenCode}, atas nama ${nama}, silakan menuju ${info.teamVoice}.`;
    } else {
        text = `Nomor antrian, ${spokenCode}, silakan menuju ${info.teamVoice}.`;
    }

    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'id-ID';
    msg.rate = 0.88; // Sedikit santai agar terdengar sangat berwibawa dan artikulatif
    
    // Gunakan voice bahasa Indonesia jika terpasang di sistem pengguna
    const idVoice = voices.find(v => v.lang.toLowerCase().includes('id'));
    if (idVoice) msg.voice = idVoice;

    window.speechSynthesis.speak(msg);
}
