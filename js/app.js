// js/app.js - Registrasi Online Donor Darah STMC

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const timParam = urlParams.get('tim'); // '?tim=P' atau '?tim=M'
    
    const selectTim = document.getElementById('kode_tim');
    const btnDaftar = document.getElementById('btn-daftar');
    const formDaftar = document.getElementById('form-daftar');

    const regSection = document.getElementById('registration-section');
    const ticketSection = document.getElementById('ticket-section');

    // Cek parameter dari QR Code / Link
    if (timParam === 'P' || timParam === 'M') {
        selectTim.value = timParam;
    }

    let currentMyQueue = null;

    formDaftar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('nama_pendonor').value;
        const nomor_id = document.getElementById('nomor_id').value;
        const unit_kerja = document.getElementById('unit_kerja').value;
        const no_hp = document.getElementById('no_hp').value;
        const gol_darah = document.getElementById('gol_darah').value;
        const tim = selectTim.value;

        btnDaftar.disabled = true;
        btnDaftar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mendaftar...';

        try {
            // Gunakan RPC untuk auto-increment nomor antrian
            const { data, error } = await supabaseClient.rpc('get_next_antrian', {
                p_kode_tim: tim,
                p_nama: nama,
                p_metode: 'QR',
                p_nomor_id: nomor_id,
                p_unit_kerja: unit_kerja,
                p_no_hp: no_hp,
                p_gol_darah: gol_darah
            });

            if (error) throw error;

            currentMyQueue = data;
            showTicket(currentMyQueue);
            subscribeToCurrentServing(tim);

        } catch (error) {
            console.error('Error:', error);
            alert('Gagal mengambil nomor antrian. Periksa koneksi atau konfigurasi database.');
            btnDaftar.disabled = false;
            btnDaftar.innerHTML = 'Ambil Nomor Antrian';
        }
    });

    function showTicket(queueData) {
        regSection.classList.add('d-none');
        ticketSection.classList.remove('d-none');

        const isPangkep = queueData.kode_tim === 'P';
        const prefix = isPangkep ? 'P' : 'MO'; // Makassar Online mendapatkan kode MO
        const queueNumber = `${prefix}-${String(queueData.nomor_urut).padStart(3, '0')}`;
        const queueColor = isPangkep ? '#fd7e14' : '#D32F2F';

        const displayEl = document.getElementById('nomor-antrian-display');
        displayEl.innerText = queueNumber;
        displayEl.style.color = queueColor;

        const jalurEl = document.getElementById('jalur-display');
        jalurEl.innerText = isPangkep ? 'UTD Pangkep & STMC' : 'PMI Makassar & STMC (Online)';
        jalurEl.style.color = queueColor;

        document.getElementById('nama-display').innerText = queueData.nama_pendonor;

        // Generate Digital Barcode
        JsBarcode("#barcode-canvas", queueNumber, {
            format: "CODE128",
            lineColor: "#1e293b",
            width: 3,
            height: 60,
            displayValue: true
        });
    }

    function subscribeToCurrentServing(tim) {
        fetchCurrentServing(tim);
        setInterval(() => fetchCurrentServing(tim), 5000);
    }

    async function fetchCurrentServing(tim) {
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const startIso = startOfDay.toISOString();
            const timFilter = tim === 'M' ? ['M', 'MM', 'MO'] : ['P'];
            
            const { data, error } = await supabaseClient
                .from('antrian')
                .select('*')
                .in('kode_tim', timFilter)
                .eq('status', 'dipanggil')
                .gte('waktu_ambil', startIso)
                .order('waktu_panggil', { ascending: false })
                .limit(1);

            const servingEl = document.getElementById('current-serving-display');
            if (data && data.length > 0) {
                const item = data[0];
                const kode = (item.kode_tim || '').toUpperCase();
                const metode = (item.metode_input || '').toUpperCase();
                let prefix = 'MO';
                if (kode === 'P') prefix = 'P';
                else if (kode === 'MM' || (kode === 'M' && metode === 'MANUAL')) prefix = 'MM';

                servingEl.innerText = `${prefix}-${String(item.nomor_urut).padStart(3, '0')}`;
            } else {
                servingEl.innerText = '--';
            }
        } catch (error) {
            console.error('Error fetching current serving:', error);
        }
    }
});
