// js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const loginTim = document.getElementById('login-tim');
    const displayTim = document.getElementById('admin-tim-display');
    const queueList = document.getElementById('admin-queue-list');
    const queueCount = document.getElementById('admin-queue-count');
    const badgeNextTicket = document.getElementById('badge-next-ticket');
    
    const btnPanggil = document.getElementById('btn-panggil-selanjutnya');
    const btnMundur = document.getElementById('btn-mundur');
    const formLompat = document.getElementById('form-lompat');
    const inputLompat = document.getElementById('input-lompat-nomor');

    const formQuickReg = document.getElementById('form-quick-reg');
    const inputQuickNama = document.getElementById('quick-nama');
    const inputSearchQueue = document.getElementById('input-search-queue');
    const formManual = document.getElementById('form-manual');

    // Cek apakah ada tim yang tersimpan di memori browser
    let currentTim = localStorage.getItem('adminCurrentTim') || loginTim.value;
    loginTim.value = currentTim;

    let cachedAllQueues = [];
    let currentSearchTerm = '';

    updateTimDisplay();

    loginTim.addEventListener('change', (e) => {
        currentTim = e.target.value;
        localStorage.setItem('adminCurrentTim', currentTim);
        updateTimDisplay();
        fetchQueue();
        fetchActive();
    });

    function updateTimDisplay() {
        displayTim.innerText = currentTim === 'P' ? 'UTD Pangkep' : 'PMI Makassar';
    }

    // Polling data berkala setiap 2.5 detik
    setInterval(() => {
        fetchQueue();
        fetchActive();
    }, 2500);

    fetchQueue();
    fetchActive();

    // Helper: Mendapatkan awal hari lokal (00:00:00)
    function getStartOfDayIso() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return startOfDay.toISOString();
    }

    // --- 1. FETCH & RENDER DAFTAR ANTRIAN & STATISTIK ---
    async function fetchQueue() {
        const startIso = getStartOfDayIso();
        const { data, error } = await supabaseClient
            .from('antrian')
            .select('*')
            .eq('kode_tim', currentTim)
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true });

        if (data) {
            cachedAllQueues = data;

            // Statistik Harian
            const totalPendaftar = data.length;
            const sudahSelesai = data.filter(q => q.status === 'selesai' || q.status === 'lewat').length;
            const sisaAntrian = data.filter(q => q.status === 'menunggu').length;
            
            document.getElementById('stat-total').innerText = totalPendaftar;
            document.getElementById('stat-selesai').innerText = sudahSelesai;
            document.getElementById('stat-sisa').innerText = sisaAntrian;

            // Update Badge Nomor Kertas Berikutnya
            const maxNum = data.length > 0 ? Math.max(...data.map(d => d.nomor_urut)) : 0;
            if (badgeNextTicket) {
                badgeNextTicket.innerText = `Berikutnya: ${currentTim}-${String(maxNum + 1).padStart(3, '0')}`;
            }

            // Status tombol Panggil Selanjutnya
            btnPanggil.disabled = sisaAntrian === 0;

            renderQueueList();
        }
    }

    // Filter pencarian
    if (inputSearchQueue) {
        inputSearchQueue.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            renderQueueList();
        });
    }

    function renderQueueList() {
        queueList.innerHTML = '';

        let filtered = cachedAllQueues;
        if (currentSearchTerm) {
            filtered = cachedAllQueues.filter(item => {
                const noStr = `${item.kode_tim}-${String(item.nomor_urut).padStart(3, '0')}`.toLowerCase();
                const namaStr = (item.nama_pendonor || '').toLowerCase();
                return noStr.includes(currentSearchTerm) || namaStr.includes(currentSearchTerm);
            });
        }

        queueCount.innerText = filtered.length;

        if (filtered.length === 0) {
            queueList.innerHTML = '<li class="list-group-item text-center text-muted py-3">Tidak ada antrian yang cocok.</li>';
            return;
        }

        filtered.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';

            let statusBadge = '';
            if (item.status === 'menunggu') statusBadge = '<span class="badge bg-warning text-dark">Menunggu</span>';
            else if (item.status === 'dipanggil') statusBadge = '<span class="badge bg-primary">Dipanggil</span>';
            else if (item.status === 'selesai') statusBadge = '<span class="badge bg-success">Selesai</span>';
            else if (item.status === 'lewat') statusBadge = '<span class="badge bg-secondary">Lewat</span>';

            const namaDisplay = item.nama_pendonor || '-';
            const nomorDisplay = `${item.kode_tim}-${String(item.nomor_urut).padStart(3, '0')}`;

            li.innerHTML = `
                <div class="me-2 text-truncate" style="max-width: 65%;">
                    <strong>${nomorDisplay}</strong> 
                    <span class="ms-1 text-dark">${namaDisplay}</span>
                    <div class="mt-1">${statusBadge} <small class="text-muted ms-1">${item.metode_input}</small></div>
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary btn-edit-nama" data-id="${item.id_antrian}" data-nomor="${nomorDisplay}" data-nama="${namaDisplay}" title="Edit Nama">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-outline-primary btn-call-direct" data-id="${item.id_antrian}" data-nomor="${nomorDisplay}" title="Panggil Langsung">
                        📢
                    </button>
                </div>
            `;
            queueList.appendChild(li);
        });

        // Event listener Edit Nama
        document.querySelectorAll('.btn-edit-nama').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const id = button.getAttribute('data-id');
                const nomor = button.getAttribute('data-nomor');
                const oldNama = button.getAttribute('data-nama') === '-' ? '' : button.getAttribute('data-nama');
                
                const newNama = prompt(`Masukkan nama baru untuk antrian ${nomor}:`, oldNama);
                if (newNama !== null && newNama.trim() !== '') {
                    await supabaseClient
                        .from('antrian')
                        .update({ nama_pendonor: newNama.trim() })
                        .eq('id_antrian', id);
                    fetchQueue();
                    fetchActive();
                }
            });
        });

        // Event listener Panggil Langsung dari baris list
        document.querySelectorAll('.btn-call-direct').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const id = button.getAttribute('data-id');
                await supabaseClient
                    .from('antrian')
                    .update({ 
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });
    }

    // --- 2. FETCH & RENDER ANTRIAN AKTIF (SEDANG DILAYANI) ---
    async function fetchActive() {
        const startIso = getStartOfDayIso();
        const { data } = await supabaseClient
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
        const badgeCount = document.getElementById('active-count-badge');
        
        badgeCount.innerText = data.length;
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
                    <h4 class="text-muted mb-4">${item.nama_pendonor || '-'}</h4>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                        <button class="btn btn-outline-primary btn-ulang px-3" data-id="${item.id_antrian}">🔁 Panggil Ulang</button>
                        <button class="btn btn-success btn-selesai px-3" data-id="${item.id_antrian}">✓ Selesai</button>
                        <button class="btn btn-warning btn-lewat px-3" data-id="${item.id_antrian}">⏭ Lewati</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.btn-ulang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ waktu_panggil: new Date().toISOString() }).eq('id_antrian', id);
            });
        });

        document.querySelectorAll('.btn-selesai').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'selesai' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });

        document.querySelectorAll('.btn-lewat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'lewat' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });
    }

    // --- 3. KONTROL PEMANGGILAN ---
    // A. Tombol Panggil Selanjutnya (+)
    btnPanggil.addEventListener('click', async () => {
        const startIso = getStartOfDayIso();
        const { data } = await supabaseClient
            .from('antrian')
            .select('id_antrian')
            .eq('kode_tim', currentTim)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            await supabaseClient
                .from('antrian')
                .update({ 
                    status: 'dipanggil',
                    waktu_panggil: new Date().toISOString()
                })
                .eq('id_antrian', data[0].id_antrian);
            
            fetchQueue();
            fetchActive();
        }
    });

    // B. Tombol Mundur (-)
    if (btnMundur) {
        btnMundur.addEventListener('click', async () => {
            const startIso = getStartOfDayIso();
            // Cari antrian terakhir yang selesai atau lewat untuk dipanggil kembali
            const { data } = await supabaseClient
                .from('antrian')
                .select('*')
                .eq('kode_tim', currentTim)
                .in('status', ['selesai', 'lewat'])
                .gte('waktu_ambil', startIso)
                .order('waktu_panggil', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                await supabaseClient
                    .from('antrian')
                    .update({ 
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', data[0].id_antrian);
                fetchQueue();
                fetchActive();
            } else {
                alert('Tidak ada antrian sebelumnya untuk dimundurkan.');
            }
        });
    }

    // C. Form Lompat ke Nomor Tertentu
    if (formLompat) {
        formLompat.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetNum = parseInt(inputLompat.value);
            if (!targetNum || targetNum < 1) return;

            const startIso = getStartOfDayIso();
            
            // Cek apakah nomor ini sudah terdaftar hari ini
            const { data } = await supabaseClient
                .from('antrian')
                .select('*')
                .eq('kode_tim', currentTim)
                .eq('nomor_urut', targetNum)
                .gte('waktu_ambil', startIso)
                .limit(1);

            if (data && data.length > 0) {
                // Jika sudah ada, langsung ubah status menjadi dipanggil
                await supabaseClient
                    .from('antrian')
                    .update({
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', data[0].id_antrian);
            } else {
                // Jika belum ada di sistem, buatkan otomatis slotnya dan langsung panggil
                await supabaseClient
                    .from('antrian')
                    .insert({
                        kode_tim: currentTim,
                        nomor_urut: targetNum,
                        nama_pendonor: `Peserta ${targetNum}`,
                        metode_input: 'Manual',
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    });
            }

            inputLompat.value = '';
            fetchQueue();
            fetchActive();
        });
    }

    // --- 4. REGISTRASI CEPAT MEJA DEPAN (PEMBERIAN KERTAS) ---
    if (formQuickReg) {
        formQuickReg.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawNama = inputQuickNama.value.trim();
            const nama = rawNama || '-';

            const btnSubmit = formQuickReg.querySelector('button');
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

                inputQuickNama.value = '';
                inputQuickNama.focus(); // Tetap fokus agar bisa langsung input orang berikutnya
                fetchQueue();
            } catch (err) {
                console.error(err);
                alert('Gagal meregistrasi antrian.');
            } finally {
                btnSubmit.disabled = false;
            }
        });
    }

    // Modal Input Manual (Data Lengkap)
    if (formManual) {
        formManual.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nama = document.getElementById('manual_nama').value;
            const nomor_id = document.getElementById('manual_nomor_id').value || '-';
            const unit_kerja = document.getElementById('manual_unit_kerja').value || '-';
            const no_hp = document.getElementById('manual_no_hp').value || '-';
            const gol_darah = document.getElementById('manual_gol_darah').value;

            const btnSubmit = document.getElementById('btn-submit-manual');
            btnSubmit.disabled = true;
            btnSubmit.innerText = 'Menambahkan...';

            try {
                const { error } = await supabaseClient.rpc('get_next_antrian', {
                    p_kode_tim: currentTim,
                    p_nama: nama,
                    p_metode: 'Manual',
                    p_nomor_id: nomor_id,
                    p_unit_kerja: unit_kerja,
                    p_no_hp: no_hp,
                    p_gol_darah: gol_darah
                });
                
                if (error) throw error;

                formManual.reset();
                fetchQueue();
                
                const manualModalElement = document.getElementById('manualModal');
                const manualModal = bootstrap.Modal.getInstance(manualModalElement);
                if (manualModal) manualModal.hide();
            } catch (err) {
                console.error(err);
                alert('Gagal menambah antrian.');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerText = 'Tambah ke Antrian';
            }
        });
    }

    // --- 5. EKSPOR KE EXCEL (CSV) ---
    document.getElementById('btn-export').addEventListener('click', async () => {
        const startIso = getStartOfDayIso();
        const todayStr = new Date().toISOString().split('T')[0];
        
        try {
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

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID Antrian,Tim,Nomor Urut,NRP/NIK,Nama Pendonor,Unit Kerja,No HP,Gol Darah,Metode Input,Status,Waktu Ambil,Waktu Panggil\n";

            data.forEach(row => {
                const id = row.id_antrian;
                const tim = row.kode_tim === 'P' ? 'UTD Pangkep' : 'PMI Makassar';
                const nomor = `${row.kode_tim}-${String(row.nomor_urut).padStart(3, '0')}`;
                
                const nik = `"${row.nomor_id || '-'}"`;
                const nama = `"${row.nama_pendonor || '-'}"`;
                const unit = `"${row.unit_kerja || '-'}"`;
                const hp = `"${row.no_hp || '-'}"`;
                const gol = `"${row.gol_darah || '-'}"`;
                
                const metode = row.metode_input;
                const status = row.status;
                const wAmbil = new Date(row.waktu_ambil).toLocaleString('id-ID');
                const wPanggil = row.waktu_panggil ? new Date(row.waktu_panggil).toLocaleString('id-ID') : '-';

                csvContent += `${id},"${tim}",${nomor},${nik},${nama},${unit},${hp},${gol},${metode},${status},"${wAmbil}","${wPanggil}"\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Rekap_Antrian_${todayStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Error saat ekspor:', err);
            alert('Gagal mengekspor data ke Excel.');
        }
    });
});
