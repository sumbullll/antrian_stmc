// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const timParam = urlParams.get('tim'); // '?tim=P' atau '?tim=M'
    
    const selectTim = document.getElementById('kode_tim');
    const btnDaftar = document.getElementById('btn-daftar');
    const errorJalur = document.getElementById('error-jalur');
    const formDaftar = document.getElementById('form-daftar');

    const regSection = document.getElementById('registration-section');
    const ticketSection = document.getElementById('ticket-section');

    // Cek parameter dari QR Code (Opsional, agar bisa auto-select jika pakai QR)
    if (timParam === 'P' || timParam === 'M') {
        selectTim.value = timParam;
    }

    let currentMyQueue = null;

    formDaftar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('nama_pendonor').value;
        const tim = selectTim.value;

        btnDaftar.disabled = true;
        btnDaftar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mendaftar...';

        try {
            // Gunakan RPC untuk mencegah bentrok nomor antrian
            const { data, error } = await supabaseClient.rpc('get_next_antrian', {
                p_kode_tim: tim,
                p_nama: nama,
                p_metode: 'QR'
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

        const queueNumber = `${queueData.kode_tim}-${String(queueData.nomor_urut).padStart(3, '0')}`;
        document.getElementById('nomor-antrian-display').innerText = queueNumber;
        document.getElementById('jalur-display').innerText = queueData.kode_tim === 'P' ? 'Semen Tonasa Medical Center' : 'PMI Makassar';
        document.getElementById('nama-display').innerText = queueData.nama_pendonor;

        // Generate Digital Barcode
        JsBarcode("#barcode-canvas", queueNumber, {
            format: "CODE128",
            lineColor: "#333",
            width: 3,
            height: 60,
            displayValue: true
        });
    }

    function subscribeToCurrentServing(tim) {
        // Polling sederhana atau Realtime Supabase
        // Karena Vercel/Supabase free tier, kita bisa gunakan polling setiap 5 detik
        fetchCurrentServing(tim);
        setInterval(() => fetchCurrentServing(tim), 5000);
    }

    async function fetchCurrentServing(tim) {
        try {
            // Cari antrian dengan status 'dipanggil' hari ini untuk tim ini
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const startIso = startOfDay.toISOString();
            
            const { data, error } = await supabaseClient
                .from('antrian')
                .select('nomor_urut')
                .eq('kode_tim', tim)
                .eq('status', 'dipanggil')
                .gte('waktu_ambil', startIso)
                .order('waktu_panggil', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                document.getElementById('current-serving-display').innerText = `${tim}-${String(data[0].nomor_urut).padStart(3, '0')}`;
            } else {
                document.getElementById('current-serving-display').innerText = '--';
            }
        } catch (error) {
            console.error('Error fetching current serving:', error);
        }
    }
});
