// js/display.js

let displayTim = null;
let lastUpdate = null;
let isAudioInitialized = false;

// Initialize TTS voices
let voices = [];
function populateVoiceList() {
    voices = window.speechSynthesis.getVoices();
}
populateVoiceList();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

window.setDisplay = function(tim) {
    displayTim = tim;
    document.getElementById('config-overlay').classList.add('d-none');
    
    // Set Theme
    const header = document.getElementById('header-bar');
    const title = document.getElementById('tv-title');
    
    if (tim === 'P') {
        header.classList.add('theme-pangkep');
        title.innerText = 'UTD Pangkep (P)';
    } else {
        header.classList.add('theme-makassar');
        title.innerText = 'PMI Makassar (M)';
    }

    // Try to init audio (browsers usually require user interaction)
    initAudio();
    
    // Start Polling
    setInterval(fetchCurrentDisplay, 2000); // Poll every 2 seconds for quick sync
    fetchCurrentDisplay();
}

// Trick for autoplay policy
document.getElementById('btn-init-audio').addEventListener('click', initAudio);

function initAudio() {
    if (!isAudioInitialized) {
        const msg = new SpeechSynthesisUtterance('');
        msg.volume = 0;
        window.speechSynthesis.speak(msg);
        isAudioInitialized = true;
        console.log('Audio initialized');
    }
}

let lastWaitingHTML = '';

async function fetchCurrentDisplay() {
    if (!displayTim) return;

    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        
        // Fetch antrian yang sedang dipanggil (maksimal 4 di TV agar grid rapi dan tidak overflow)
        const panggilPromise = supabaseClient
            .from('antrian')
            .select('*')
            .eq('kode_tim', displayTim)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', startIso)
            .order('waktu_panggil', { ascending: false })
            .limit(4);
            
        // Fetch antrian yang sedang menunggu (ambil 50 antrian berikutnya agar marquee ringan dan lancar)
        const tungguPromise = supabaseClient
            .from('antrian')
            .select('nomor_urut, nama_pendonor')
            .eq('kode_tim', displayTim)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true })
            .limit(50);

        const [resPanggil, resTunggu] = await Promise.all([panggilPromise, tungguPromise]);

        // Selalu update UI dengan daftar yang aktif saat ini
        updateUI(resPanggil.data || []);

        // Audio Announcement hanya dipicu oleh pembaruan pada item yang paling baru
        if (resPanggil.data && resPanggil.data.length > 0) {
            const currentItem = resPanggil.data[0];
            if (lastUpdate !== currentItem.waktu_panggil) {
                speakAnnouncement(currentItem);
                lastUpdate = currentItem.waktu_panggil;
            }
        }
        
        // Update Daftar Menunggu (Render ke Container Auto-Scroll)
        if (resTunggu.data) {
            const waitingListEl = document.getElementById('tv-waiting-list');
            if (waitingListEl) {
                let listHTML = '';
                // Warna khusus: Orange untuk Pangkep, Merah untuk Makassar
                const queueColor = displayTim === 'P' ? '#fd7e14' : '#dc3545';

                if (resTunggu.data.length > 0) {
                    listHTML = resTunggu.data.map(q => {
                        const nama = (q.nama_pendonor && q.nama_pendonor !== '-') ? `<div class="fs-6 text-muted fw-normal">${q.nama_pendonor}</div>` : '';
                        return `<div class="py-3 border-bottom border-light">
                            <span class="fs-3 fw-bolder" style="color: ${queueColor}; letter-spacing: 0.5px;">${displayTim}-${String(q.nomor_urut).padStart(3, '0')}</span>
                            ${nama}
                        </div>`;
                    }).join('');
                } else {
                    listHTML = `<div class="py-5 text-muted fw-normal">Belum ada antrian...</div>`;
                }

                if (listHTML !== lastWaitingHTML) {
                    lastWaitingHTML = listHTML;
                    waitingListEl.innerHTML = listHTML;
                }
            }
        }
    } catch (err) {
        console.error('Error fetching display data:', err);
    }
}

// Auto-Scroll Halus untuk Daftar Menunggu (Tidak pernah blank, tidak ter-reset)
setInterval(() => {
    const scrollBox = document.getElementById('waiting-scroll-container');
    if (scrollBox && scrollBox.scrollHeight > scrollBox.clientHeight) {
        scrollBox.scrollTop += 1;
        if (scrollBox.scrollTop >= scrollBox.scrollHeight - scrollBox.clientHeight) {
            scrollBox.scrollTop = 0; // Ulangi ke paling atas
        }
    }
}, 45);

function updateUI(items) {
    const grid = document.getElementById('tv-active-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-muted my-auto">
                <h1 class="display-1 fw-bold text-secondary">--</h1>
                <h3 class="name-box text-muted">Silakan Menunggu</h3>
            </div>`;
        return;
    }

    grid.innerHTML = ''; // Kosongkan grid

    // Batasi maksimal 4 antrian aktif di layar TV agar grid proporsional dan tidak terpotong
    const displayItems = items.slice(0, 4);
    const colClass = displayItems.length === 1 ? 'col-12' : 'col-6';
    const themeColor = displayTim === 'P' ? '#fd7e14' : '#dc3545';
    const themeShadow = displayTim === 'P' ? 'rgba(253,126,20,0.35)' : 'rgba(220,53,69,0.35)';

    displayItems.forEach((item, index) => {
        const isLatest = index === 0;
        const borderStyle = isLatest ? `border: 4px solid ${themeColor} !important;` : 'border: 2px solid #cbd5e1;';
        const shadowStyle = isLatest ? `box-shadow: 0 10px 25px ${themeShadow} !important;` : 'box-shadow: 0 4px 6px rgba(0,0,0,0.06);';
        const nama = (item.nama_pendonor && item.nama_pendonor !== '-') ? item.nama_pendonor : 'Peserta Donor';
        const numFontSize = displayItems.length > 2 ? '5vw' : (displayItems.length === 2 ? '6.5vw' : '9.5vw');
        const nameFontSize = displayItems.length > 2 ? '1.8vw' : (displayItems.length === 2 ? '2.2vw' : '3vw');

        const cardHTML = `
            <div class="${colClass} p-2 my-auto">
                <div class="card bg-white" style="${borderStyle} ${shadowStyle} border-radius: 18px;">
                    <div class="card-body py-4 px-2 d-flex flex-column justify-content-center align-items-center">
                        <div style="font-size: ${numFontSize}; font-weight: 900; line-height: 1; color: #0f172a;">
                            ${item.kode_tim}-${String(item.nomor_urut).padStart(3, '0')}
                        </div>
                        <div style="font-size: ${nameFontSize}; font-weight: 600; color: #475569; margin-top: 15px; word-break: break-word;">
                            ${nama}
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// --- Fitur Jam Digital ---
setInterval(() => {
    const clockObj = new Date();
    const timeString = clockObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = clockObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const clockEl = document.getElementById('tv-clock');
    if(clockEl) clockEl.innerText = `${dateString}  |  ${timeString}`;
}, 1000);

// --- Fitur Suara Ting-Tong (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playChime() {
    return new Promise((resolve) => {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        
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

async function speakAnnouncement(item) {
    if (!('speechSynthesis' in window)) return;

    // Putar bel Ting-Tong terlebih dahulu
    await playChime();

    const timName = item.kode_tim === 'P' ? 'UTD Pangkep' : 'PMI Makassar';
    const nomorTeks = `${item.kode_tim}, ${String(item.nomor_urut).padStart(3, '0')}`;
    
    let text = '';
    const nama = (item.nama_pendonor || '').trim();
    if (nama && nama !== '-' && !nama.toLowerCase().startsWith('peserta ')) {
        text = `Nomor antrian, ${nomorTeks}, atas nama ${nama}, silakan menuju ${timName}.`;
    } else {
        text = `Nomor antrian, ${nomorTeks}, silakan menuju ${timName}.`;
    }

    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'id-ID';
    msg.rate = 0.9; // Sedikit lebih lambat agar jelas
    
    // Cari voice bahasa Indonesia jika ada
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) msg.voice = idVoice;

    window.speechSynthesis.speak(msg);
}
