// js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginTim = document.getElementById('login-tim');
    const displayTim = document.getElementById('admin-tim-display');
    const queueList = document.getElementById('admin-queue-list');
    const queueCount = document.getElementById('admin-queue-count');
    
    const btnPanggil = document.getElementById('btn-panggil-selanjutnya');
    const btnSelesai = document.getElementById('btn-selesai');
    const btnLewat = document.getElementById('btn-lewat');
    const formManual = document.getElementById('form-manual');

    let currentTim = loginTim.value;
    let activeQueueId = null;

    updateTimDisplay();

    loginTim.addEventListener('change', (e) => {
        currentTim = e.target.value;
        updateTimDisplay();
        fetchQueue();
        fetchActive();
    });

    function updateTimDisplay() {
        displayTim.innerText = currentTim === 'P' ? 'Pangkep' : 'Makassar';
    }

    // Refresh data setiap 3 detik
    setInterval(() => {
        fetchQueue();
    }, 3000);

    fetchQueue();
    fetchActive();

    async function fetchQueue() {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('antrian')
            .select('*')
            .eq('kode_tim', currentTim)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', `${today}T00:00:00Z`)
            .order('nomor_urut', { ascending: true });

        if (data) {
            queueCount.innerText = data.length;
            renderQueueList(data);
        }
    }

    function renderQueueList(data) {
        queueList.innerHTML = '';
        if (data.length === 0) {
            queueList.innerHTML = '<li class="list-group-item text-center text-muted">Belum ada antrian.</li>';
            btnPanggil.disabled = true;
            return;
        }

        btnPanggil.disabled = false;
        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    <strong>${item.kode_tim}-${item.nomor_urut}</strong>
                    <span class="ms-2 text-muted">${item.nama_pendonor}</span>
                </div>
                <span class="badge bg-secondary rounded-pill">${item.metode_input}</span>
            `;
            queueList.appendChild(li);
        });
    }

    async function fetchActive() {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('antrian')
            .select('*')
            .eq('kode_tim', currentTim)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', `${today}T00:00:00Z`)
            .order('waktu_panggil', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            setActiveQueue(data[0]);
        } else {
            clearActiveQueue();
        }
    }

    function setActiveQueue(item) {
        activeQueueId = item.id_antrian;
        document.getElementById('admin-current-nomor').innerText = `${item.kode_tim}-${item.nomor_urut}`;
        document.getElementById('admin-current-nama').innerText = item.nama_pendonor;
        btnSelesai.disabled = false;
        btnLewat.disabled = false;
        btnPanggil.innerText = 'Panggil Ulang';
    }

    function clearActiveQueue() {
        activeQueueId = null;
        document.getElementById('admin-current-nomor').innerText = '--';
        document.getElementById('admin-current-nama').innerText = 'Tidak ada antrian aktif';
        btnSelesai.disabled = true;
        btnLewat.disabled = true;
        btnPanggil.innerText = 'Panggil Selanjutnya';
    }

    // Action Buttons
    btnPanggil.addEventListener('click', async () => {
        if (activeQueueId) {
            // Panggil ulang - update waktu_panggil
            await supabase
                .from('antrian')
                .update({ waktu_panggil: new Date().toISOString() })
                .eq('id_antrian', activeQueueId);
            alert('Antrian dipanggil ulang');
            return;
        }

        // Panggil nomor pertama yang menunggu
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('antrian')
            .select('id_antrian')
            .eq('kode_tim', currentTim)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', `${today}T00:00:00Z`)
            .order('nomor_urut', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            const nextId = data[0].id_antrian;
            await supabase
                .from('antrian')
                .update({ 
                    status: 'dipanggil',
                    waktu_panggil: new Date().toISOString()
                })
                .eq('id_antrian', nextId);
            
            fetchQueue();
            fetchActive();
        }
    });

    btnSelesai.addEventListener('click', async () => {
        if (activeQueueId) {
            await supabase
                .from('antrian')
                .update({ status: 'selesai' })
                .eq('id_antrian', activeQueueId);
            clearActiveQueue();
            fetchQueue();
        }
    });

    btnLewat.addEventListener('click', async () => {
        if (activeQueueId) {
            await supabase
                .from('antrian')
                .update({ status: 'lewat' })
                .eq('id_antrian', activeQueueId);
            clearActiveQueue();
            fetchQueue();
        }
    });

    // Manual Input
    formManual.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('manual_nama').value;
        const btnSubmit = formManual.querySelector('button');
        btnSubmit.disabled = true;

        try {
            await supabase.rpc('get_next_antrian', {
                p_kode_tim: currentTim,
                p_nama: nama,
                p_metode: 'Manual'
            });
            document.getElementById('manual_nama').value = '';
            fetchQueue();
        } catch (err) {
            console.error(err);
            alert('Gagal menambah antrian manual.');
        } finally {
            btnSubmit.disabled = false;
        }
    });
});
