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

    // Cek parameter dari QR Code
    if (timParam === 'P' || timParam === 'M') {
        selectTim.value = timParam;
        btnDaftar.disabled = false;
    } else {
        errorJalur.classList.remove('d-none');
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
            const { data, error } = await supabase.rpc('get_next_antrian', {
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

        document.getElementById('nomor-antrian-display').innerText = `${queueData.kode_tim}-${queueData.nomor_urut}`;
        document.getElementById('jalur-display').innerText = queueData.kode_tim === 'P' ? 'Medical Center Pangkep' : 'PMI Makassar';
        document.getElementById('nama-display').innerText = queueData.nama_pendonor;
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
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('antrian')
                .select('nomor_urut')
                .eq('kode_tim', tim)
                .eq('status', 'dipanggil')
                .gte('waktu_ambil', `${today}T00:00:00Z`)
                .order('waktu_panggil', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                document.getElementById('current-serving-display').innerText = `${tim}-${data[0].nomor_urut}`;
            } else {
                document.getElementById('current-serving-display').innerText = '--';
            }
        } catch (error) {
            console.error('Error fetching current serving:', error);
        }
    }
});
