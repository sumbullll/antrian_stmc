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
        title.innerText = 'Medical Center Pangkep (P)';
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

async function fetchCurrentDisplay() {
    if (!displayTim) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('antrian')
            .select('*')
            .eq('kode_tim', displayTim)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', `${today}T00:00:00Z`)
            .order('waktu_panggil', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const currentItem = data[0];
            
            // Cek apakah ini panggilan baru berdasarkan waktu_panggil
            if (lastUpdate !== currentItem.waktu_panggil) {
                updateUI(currentItem);
                speakAnnouncement(currentItem);
                lastUpdate = currentItem.waktu_panggil;
            }
        }
    } catch (err) {
        console.error('Error fetching display data:', err);
    }
}

function updateUI(item) {
    const numBox = document.getElementById('tv-number');
    const nameBox = document.getElementById('tv-name');
    
    numBox.innerText = `${item.kode_tim}-${item.nomor_urut}`;
    nameBox.innerText = item.nama_pendonor;

    // Tambah efek flash
    numBox.classList.remove('highlight-update');
    void numBox.offsetWidth; // trigger reflow
    numBox.classList.add('highlight-update');
}

function speakAnnouncement(item) {
    if (!('speechSynthesis' in window)) return;

    const timName = item.kode_tim === 'P' ? 'Medical Center Pangkep' : 'PMI Makassar';
    const text = `Nomor antrian, ${item.kode_tim}, ${item.nomor_urut}, atas nama ${item.nama_pendonor}, silakan menuju tim ${timName}.`;

    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'id-ID';
    msg.rate = 0.9; // Sedikit lebih lambat agar jelas
    
    // Cari voice bahasa Indonesia jika ada
    const idVoice = voices.find(v => v.lang.includes('id'));
    if (idVoice) msg.voice = idVoice;

    window.speechSynthesis.speak(msg);
}
