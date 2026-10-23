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
            color: '#e65100',        // Oranye Khas Karcis Pangkep
            heroGradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 50%, #ff8f00 100%)',
            heroPulseClass: 'hero-calling-P',
            bgSoft: '#fffaf5',
            borderSoft: '#fed7aa',
            badgeBg: '#fff3e0',
            badgeText: '#d9480f'
        };
    } else if (kode === 'MM' || (kode === 'M' && metode === 'MANUAL')) {
        return {
            prefix: 'MM',
            fullCode: `MM-${numStr}`,
            badgeType: 'PMI Makassar (Manual)',
            teamVoice: 'PMI Makassar',
            color: '#1976D2',        // Biru Khas Karcis MM Manual
            heroGradient: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 50%, #1976d2 100%)',
            heroPulseClass: 'hero-calling-MM',
            bgSoft: '#f0f7ff',
            borderSoft: '#bae6fd',
            badgeBg: '#e0f2fe',
            badgeText: '#0369a1'
        };
    } else { // 'MO' atau 'M' dengan metode QR/Online
        return {
            prefix: 'MO',
            fullCode: `MO-${numStr}`,
            badgeType: 'PMI Makassar (Online)',
            teamVoice: 'PMI Makassar',
            color: '#D32F2F',        // Merah Khas Karcis MO Online
            heroGradient: 'linear-gradient(135deg, #b71c1c 0%, #c62828 50%, #d32f2f 100%)',
            heroPulseClass: 'hero-calling-MO',
            bgSoft: '#fff5f5',
            borderSoft: '#fecaca',
            badgeBg: '#fee2e2',
            badgeText: '#b91c1c'
        };
    }
}

// Helper: Mencegah Duplikasi Nomor Antrian di Layar
function deduplicateQueues(items) {
    if (!items || items.length === 0) return [];
    const map = new Map();
    for (const item of items) {
        const info = getTicketInfo(item);
        const key = `${info.prefix}-${item.nomor_urut}`;
        if (!map.has(key)) {
            map.set(key, item);
        } else {
            const prev = map.get(key);
            const prevTime = prev.waktu_panggil || prev.waktu_ambil || '';
            const currTime = item.waktu_panggil || item.waktu_ambil || '';
            if (currTime > prevTime) {
                map.set(key, item);
            }
        }
    }
    return Array.from(map.values());
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

function initAudio() {
    if (!isAudioInitialized) {
        const msg = new SpeechSynthesisUtterance('');
        msg.volume = 0;
        window.speechSynthesis.speak(msg);
        if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        isAudioInitialized = true;
        console.log('Audio initialized');
    }
}

// Trick untuk Autoplay Policy Browser
const btnInitAudio = document.getElementById('btn-init-audio');
if (btnInitAudio) {
    btnInitAudio.addEventListener('click', initAudio);
}

// Inisialisasi audio saat ada klik/interaksi pertama di layar
['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, initAudio, { passive: true, once: true });
});

// --- FUNGSI UTAMA: MENYETEL DISPLAY TV ---
window.setDisplay = function(tim) {
    displayTim = tim;
    
    // Simpan pilihan ke sessionStorage (khusus tab ini saja, agar TV 1 dan TV 2 tidak saling menimpa)
    sessionStorage.setItem('displayTim', tim);
    localStorage.removeItem('displayTim'); // Bersihkan storage global lama
    
    // Update parameter URL agar saat halaman di-reload (F5) tetap berada di layar yang sama
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
            subtitle.innerText = 'MM Biru (Manual) & MO Merah (Online)';
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
    sessionStorage.removeItem('displayTim');
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

// Cek Otomatis Saat Halaman Dimuat: Tetap di Pilihan Terakhir pada Tab/Layar ini!
document.addEventListener('DOMContentLoaded', () => {
    // Hapus storage global lama agar tab 1 dan tab 2 tidak saling mempengaruhi
    localStorage.removeItem('displayTim');

    const urlParams = new URLSearchParams(window.location.search);
    const paramTim = urlParams.get('tim');
    const savedSessionTim = sessionStorage.getItem('displayTim');
    
    // Prioritaskan parameter URL (?tim=P atau ?tim=M), lalu sessionStorage khusus tab ini
    const targetTim = (paramTim === 'P' || paramTim === 'M') ? paramTim : 
                      ((savedSessionTim === 'P' || savedSessionTim === 'M') ? savedSessionTim : null);

    if (targetTim) {
        window.setDisplay(targetTim);
    } else {
        // Tampilkan modal pemilihan jika tab/layar ini belum memilih
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

        // 1. Fetch antrian yang sedang dipanggil (tanpa batasan 4, mencakup >10 bed donor aktif)
        const panggilPromise = supabaseClient
            .from('antrian')
            .select('*')
            .in('kode_tim', timFilter)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', startIso)
            .order('waktu_panggil', { ascending: false })
            .limit(50);
            
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

        // Deduplikasi antrian aktif agar tidak ada nomor yang muncul ganda di layar
        const activeItems = deduplicateQueues(resPanggil.data || []);
        const waitingItems = deduplicateQueues(resTunggu.data || []);

        // Render Antrian Aktif (Kiri)
        updateUI(activeItems);

        // Audio Announcement dipicu jika ada pembaruan pada item yang paling baru
        if (activeItems.length > 0) {
            const currentItem = activeItems[0];
            if (lastUpdate !== currentItem.waktu_panggil) {
                speakAnnouncement(currentItem);
                lastUpdate = currentItem.waktu_panggil;
            }
        }
        
        // Render Daftar Menunggu (Kanan)
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

// --- RENDER ANTRIAN AKTIF: KOTAK ATAS (SEDANG DIPANGGIL) & KOTAK BAWAH (SEDANG DILAYANI) ---
function updateUI(items) {
    const container = document.getElementById('tv-active-container') || document.getElementById('tv-active-grid');
    if (!container) return;

    // Pastikan bebas duplikasi
    const displayItems = deduplicateQueues(items);
    const count = displayItems.length;

    // Update deskripsi status bed aktif
    const descBadge = document.getElementById('tv-active-status-desc');
    if (descBadge) {
        if (count === 0) {
            descBadge.innerText = 'Bed Donor Siap';
        } else if (count === 1) {
            descBadge.innerText = '1 Pasien Sedang Dipanggil';
        } else {
            descBadge.innerText = `1 Dipanggil • ${count - 1} di Bed Donor`;
        }
    }

    if (count === 0) {
        container.innerHTML = `
            <div class="my-auto text-center py-5">
                <h1 class="display-1 fw-bold text-secondary" style="font-size: 6vw;">--</h1>
                <h3 class="text-muted fw-semibold" style="font-size: 1.8vw;">Silakan Menunggu Panggilan</h3>
            </div>
        `;
        return;
    }

    // 1. Antrian paling baru dipanggil -> Kotak Utama di Atas (Hero Calling Card)
    const callingItem = displayItems[0];
    const servingItems = displayItems.slice(1);
    const callingInfo = getTicketInfo(callingItem);
    const callingNama = (callingItem.nama_pendonor && callingItem.nama_pendonor !== '-') ? callingItem.nama_pendonor : 'Peserta Donor';

    const isSolo = servingItems.length === 0;
    const heroNumSize = isSolo ? '7.5vw' : '5vw';
    const heroNameSize = isSolo ? '2.3vw' : '1.7vw';
    const heroBadgeSize = isSolo ? '1.1vw' : '0.95vw';
    const heroPadding = isSolo ? 'py-4 px-4' : 'py-3 px-3';

    let heroHTML = `
        <!-- KOTAK ATAS: SEDANG DIPANGGIL (Penuh Warna Sesuai Karcis, Berkedip Menyala, Terangkat ke Atas) -->
        <div class="hero-calling-wrapper mb-3" style="position: relative; z-index: 10;">
            <div class="card border-0 text-white ${callingInfo.heroPulseClass}" 
                 style="background: ${callingInfo.heroGradient}; border-radius: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.2);">
                <div class="card-body ${heroPadding} text-center d-flex flex-column align-items-center justify-content-center">
                    
                    <div class="d-flex align-items-center justify-content-center gap-2 mb-1">
                        <span class="badge hero-calling-badge px-3 py-1 fw-bolder text-uppercase" 
                              style="font-size: ${heroBadgeSize}; letter-spacing: 1px;">
                            🔔 SEDANG DIPANGGIL
                        </span>
                        <span class="badge text-white px-3 py-1 fw-bold" 
                              style="background: rgba(255,255,255,0.22); font-size: ${heroBadgeSize}; border-radius: 20px; letter-spacing: 0.5px;">
                            ${callingInfo.badgeType}
                        </span>
                    </div>

                    <div class="fw-bolder my-1" 
                         style="font-size: ${heroNumSize}; line-height: 1; letter-spacing: 2.5px; text-shadow: 0 4px 14px rgba(0,0,0,0.3);">
                        ${callingInfo.fullCode}
                    </div>

                    <div class="fw-bold text-white text-truncate w-100" 
                         style="font-size: ${heroNameSize}; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.25);">
                        ${callingNama}
                    </div>

                    <small class="text-white-50 mt-1" style="font-size: ${isSolo ? '1vw' : '0.85vw'};">
                        Silakan segera memasuki Ruang Donor Darah
                    </small>
                </div>
            </div>
        </div>
    `;

    // 2. Antrian lain yang sedang dilayani di bed-bed donor -> Kotak-Kotak di Bawah
    let servingHTML = '';
    if (!isSolo) {
        let colClass = 'col-6';
        let sNumSize = '3.5vw';
        let sNameSize = '1.3vw';
        let sBadgeSize = '0.85vw';

        if (servingItems.length === 1) {
            colClass = 'col-12';
            sNumSize = '4.2vw';
            sNameSize = '1.5vw';
            sBadgeSize = '0.9vw';
        } else if (servingItems.length <= 4) {
            colClass = 'col-6';
            sNumSize = '3.2vw';
            sNameSize = '1.2vw';
            sBadgeSize = '0.8vw';
        } else if (servingItems.length <= 6) {
            colClass = 'col-4';
            sNumSize = '2.5vw';
            sNameSize = '1.05vw';
            sBadgeSize = '0.75vw';
        } else {
            colClass = 'col-3';
            sNumSize = '2.0vw';
            sNameSize = '0.9vw';
            sBadgeSize = '0.7vw';
        }

        const cardsHTML = servingItems.map(item => {
            const info = getTicketInfo(item);
            const nama = (item.nama_pendonor && item.nama_pendonor !== '-') ? item.nama_pendonor : 'Peserta Donor';

            return `
                <div class="${colClass} p-1 p-xl-2">
                    <div class="card shadow-sm h-100 border-0" 
                         style="background-color: #ffffff; border: 2px solid ${info.borderSoft} !important; border-top: 5px solid ${info.color} !important; border-radius: 14px;">
                        <div class="card-body py-2 px-2 text-center d-flex flex-column justify-content-center align-items-center">
                            <div class="badge badge-status-layani px-2 py-1 mb-1" style="font-size: ${sBadgeSize};">
                                🩺 SEDANG DILAYANI
                            </div>
                            <div class="fw-bold mb-1" style="color: ${info.color}; font-size: ${sBadgeSize}; letter-spacing: 0.5px;">
                                ${info.badgeType}
                            </div>
                            <div style="font-size: ${sNumSize}; font-weight: 900; line-height: 1; color: ${info.color}; letter-spacing: 1.2px;">
                                ${info.fullCode}
                            </div>
                            <div class="fw-semibold text-secondary text-truncate w-100 mt-1" style="font-size: ${sNameSize};">
                                ${nama}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        servingHTML = `
            <!-- KOTAK-KOTAK BAWAH: SEDANG DILAYANI DI BED DONOR (Tenang, Rapi, Teratur) -->
            <div class="serving-section flex-grow-1 d-flex flex-column" style="min-height: 0;">
                <div class="d-flex align-items-center justify-content-between mb-2 px-1">
                    <span class="fw-bold text-secondary text-uppercase" style="font-size: 0.9vw; letter-spacing: 0.8px;">
                        🩺 Pasien di Bed Donor (Sedang Dilayani)
                    </span>
                    <span class="badge bg-secondary-subtle text-secondary fw-semibold px-2 py-1" style="font-size: 0.8vw;">
                        ${servingItems.length} Pasien
                    </span>
                </div>
                <div class="row g-2 flex-grow-1 align-content-start w-100 m-0" style="overflow-y: auto; max-height: calc(100vh - 470px);">
                    ${cardsHTML}
                </div>
            </div>
        `;
    }

    container.innerHTML = heroHTML + servingHTML;
}

// --- JAM DIGITAL ---
setInterval(() => {
    const clockObj = new Date();
    const timeString = clockObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = clockObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const clockEl = document.getElementById('tv-clock');
    if (clockEl) clockEl.innerText = `${dateString}  |  ${timeString}`;
}, 1000);

// --- Fitur Suara Ting-Tong (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playChime() {
    return new Promise((resolve) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        // Buat oscillator untuk nada pertama (Ting)
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

        // Buat oscillator untuk nada kedua (Tong)
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

        // Beri jeda 1.5 detik sebelum TTS ngomong
        setTimeout(resolve, 1500);
    });
}

// Helper: Ubah Kode Karcis agar Diucapkan Jelas oleh Suara TTS
function formatCodeForSpeech(fullCode) {
    const parts = fullCode.split('-');
    const prefixSpoken = parts[0].split('').join(' '); // "M M", "M O", atau "P"
    const numberDigits = (parts[1] || '').split('').map(d => {
        if (d === '0') return 'kosong';
        return d;
    }).join(' ');

    return `${prefixSpoken}, ${numberDigits}`;
}

// --- PANGGILAN SUARA (TTS) ---
async function speakAnnouncement(item) {
    if (!('speechSynthesis' in window)) return;

    // Putar bel Ting-Tong terlebih dahulu
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
    msg.rate = 0.9; // Sedikit lebih lambat agar jelas
    
    // Cari voice bahasa Indonesia jika ada
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) msg.voice = idVoice;

    window.speechSynthesis.speak(msg);
}
