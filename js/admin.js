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

    // Cek apakah ada tim yang tersimpan di memori browser, jika tidak gunakan nilai bawaan dropdown
    let currentTim = localStorage.getItem('adminCurrentTim') || loginTim.value;
    loginTim.value = currentTim; // Pastikan dropdown menampilkan tim yang benar
    
    let activeQueueId = null;

    updateTimDisplay();

    loginTim.addEventListener('change', (e) => {
        currentTim = e.target.value;
        localStorage.setItem('adminCurrentTim', currentTim); // Simpan pilihan ke memori browser
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
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        const { data, error } = await supabaseClient
            .from('antrian')
            .select('*')
            .eq('kode_tim', currentTim)
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true });

        if (data) {
            // --- Fitur Statistik Harian ---
            const totalPendaftar = data.length;
            const sudahSelesai = data.filter(q => q.status === 'selesai' || q.status === 'lewat').length;
            const sisaAntrian = data.filter(q => q.status === 'menunggu').length;
            
            document.getElementById('stat-total').innerText = totalPendaftar;
            document.getElementById('stat-selesai').innerText = sudahSelesai;
            document.getElementById('stat-sisa').innerText = sisaAntrian;
            // ------------------------------

            const waitingData = data.filter(q => q.status === 'menunggu');
            queueCount.innerText = waitingData.length;
            renderQueueList(waitingData);
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
                    <strong>${item.kode_tim}-${String(item.nomor_urut).padStart(3, '0')}</strong>
                    <span class="ms-2 text-muted">${item.nama_pendonor}</span>
                </div>
                <span class="badge bg-secondary rounded-pill">${item.metode_input}</span>
            `;
            queueList.appendChild(li);
        });
    }

    async function fetchActive() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        const { data, error } = await supabaseClient
            .from('antrian')
            .select('*')
            .eq('kode_tim', currentTim)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', startIso)
            .order('waktu_panggil', { ascending: false });

        renderActiveQueues(data || []);
    }

    function renderActiveQueues(data) {
        const container = document.getElementById('active-queue-container');
        document.getElementById('active-count-badge').innerText = data.length;
        
        container.innerHTML = '';
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5" id="no-active-msg">
                    <h4 class="fw-light">Belum ada pasien aktif</h4>
                    <small>Klik "Panggil Selanjutnya" untuk memulai</small>
                </div>`;
            return;
        }

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card border-0 shadow-sm mb-3';
            card.innerHTML = `
                <div class="card-body text-center py-4">
                    <h1 class="display-3 fw-bold text-dark">${item.kode_tim}-${String(item.nomor_urut).padStart(3, '0')}</h1>
                    <h4 class="text-muted mb-4">${item.nama_pendonor}</h4>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                        <button class="btn btn-outline-primary btn-ulang px-4" data-id="${item.id_antrian}">🔁 Panggil Ulang</button>
                        <button class="btn btn-success btn-selesai px-4" data-id="${item.id_antrian}">✅ Selesai</button>
                        <button class="btn btn-warning btn-lewat px-4" data-id="${item.id_antrian}">⏩ Lewati</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Attach event listeners ke tombol-tombol baru
        document.querySelectorAll('.btn-ulang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ waktu_panggil: new Date().toISOString() }).eq('id_antrian', id);
                alert('Antrian dipanggil ulang');
            });
        });

        document.querySelectorAll('.btn-selesai').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'selesai' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });

        document.querySelectorAll('.btn-lewat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'lewat' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });
    }

    // Tombol Panggil Selanjutnya (Selalu panggil orang baru)
    btnPanggil.addEventListener('click', async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        const { data } = await supabaseClient
            .from('antrian')
            .select('id_antrian')
            .eq('kode_tim', currentTim)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            const nextId = data[0].id_antrian;
            await supabaseClient
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

    // Manual Input
    formManual.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('manual_nama').value;
        const btnSubmit = formManual.querySelector('button');
        btnSubmit.disabled = true;

        try {
            const { error } = await supabaseClient.rpc('get_next_antrian', {
                p_kode_tim: currentTim,
                p_nama: nama,
                p_metode: 'Manual',
                p_nomor_id: '-',
                p_unit_kerja: '-',
                p_no_hp: '-',
                p_gol_darah: '-'
            });
            
            if (error) throw error;

            document.getElementById('manual_nama').value = '';
            fetchQueue();
        } catch (err) {
            console.error(err);
            alert('Gagal menambah antrian manual.');
        } finally {
            btnSubmit.disabled = false;
        }
    });

    // Fitur Ekspor ke Excel (CSV)
    document.getElementById('btn-export').addEventListener('click', async () => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startIso = startOfDay.toISOString();
        
        try {
            // Ambil seluruh data antrian pada hari ini (baik yang selesai, lewat, maupun menunggu)
            const { data, error } = await supabaseClient
                .from('antrian')
                .select('*')
                .gte('waktu_ambil', startIso)
                .order('kode_tim', { ascending: true })
                .order('nomor_urut', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                alert('Tidak ada data antrian untuk diekspor hari ini.');
                return;
            }

            // Siapkan header CSV
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID Antrian,Tim,Nomor Urut,NRP/NIK,Nama Pendonor,Unit Kerja,No HP,Gol Darah,Metode Input,Status,Waktu Ambil,Waktu Panggil\n";

            // Isi baris data
            data.forEach(row => {
                const id = row.id_antrian;
                const tim = row.kode_tim === 'P' ? 'Semen Tonasa Medical Center' : 'PMI Makassar';
                const nomor = `${row.kode_tim}-${String(row.nomor_urut).padStart(3, '0')}`;
                
                // Bungkus teks dengan kutipan agar aman dari koma di dalam teks
                const nik = `"${row.nomor_id || '-'}"`;
                const nama = `"${row.nama_pendonor}"`;
                const unit = `"${row.unit_kerja || '-'}"`;
                const hp = `"${row.no_hp || '-'}"`;
                const gol = `"${row.gol_darah || '-'}"`;
                
                const metode = row.metode_input;
                const status = row.status;
                const wAmbil = new Date(row.waktu_ambil).toLocaleString('id-ID');
                const wPanggil = row.waktu_panggil ? new Date(row.waktu_panggil).toLocaleString('id-ID') : '-';

                csvContent += `${id},"${tim}",${nomor},${nik},${nama},${unit},${hp},${gol},${metode},${status},"${wAmbil}","${wPanggil}"\n`;
            });

            // Lakukan download otomatis
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Rekap_Antrian_Donor_Darah_${today}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Error saat ekspor:', err);
            alert('Gagal mengekspor data ke Excel.');
        }
    });
});
